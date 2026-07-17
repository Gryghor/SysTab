const db = require('../config/db');
const path = require('path');
const fs = require('fs');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const PDFDocument = require('pdfkit');
const { format } = require('date-fns');
const { ptBR } = require('date-fns/locale');


exports.criarChamado = async (req, res) => {
    const { idTab, descricao, item } = req.body;
    const sql = 'INSERT INTO chamados (idTab, descricao, item, status, dataEntrada) VALUES (?, ?, ?, "Aberto", NOW())';
    try {
        const [result] = await db.query(sql, [idTab, descricao, item]);
        res.status(201).json({ message: "Chamado criado com sucesso.", idChamado: result.insertId });
    } catch (err) {
        console.error("Error creating chamado:", err);
        res.status(500).json({ error: "Erro ao criar chamado." });
    }
};


exports.listarChamados = async (req, res) => {
    const sql = `
        SELECT chamados.*, tablets.idTomb, tablets.imei, usuarios.nomeUser, usuarios.telUser,
               unidades.nomeUnidade, regionais.numReg AS nomeRegional
        FROM chamados
        JOIN tablets ON chamados.idTab = tablets.idTab
        LEFT JOIN usuarios ON tablets.idUser = usuarios.idUser
        LEFT JOIN unidades ON usuarios.idUnidade = unidades.idUnidade
        LEFT JOIN regionais ON unidades.idReg = regionais.idReg
        ORDER BY COALESCE(regionais.numReg, 'Sem regional'), chamados.dataEntrada DESC, chamados.idChamado DESC
    `;
    try {
        const [results] = await db.query(sql);
        res.json(results);
    } catch (err) {
        res.status(500).json(err);
    }
};

const formatarDataPdf = (data) => {
    if (!data) return '-';
    const valor = new Date(data);
    return Number.isNaN(valor.getTime()) ? '-' : format(valor, 'dd/MM/yyyy', { locale: ptBR });
};

const normalizarTextoPdf = (valor, fallback = '-') => String(valor ?? fallback).replace(/\s+/g, ' ').trim() || fallback;

const formatarMesAnoPdf = (data) => {
    if (!data) return 'Sem data de entrada';
    const valor = new Date(data);
    if (Number.isNaN(valor.getTime())) return 'Sem data de entrada';
    const mesAno = format(valor, 'MMMM yyyy', { locale: ptBR });
    return mesAno.charAt(0).toUpperCase() + mesAno.slice(1);
};

const obterFontePdf = (...fontes) => fontes.find((fonte) => fs.existsSync(fonte)) || null;
const fontePdf = {
    regular: obterFontePdf(
        'C:\\Windows\\Fonts\\arial.ttf',
        '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
        '/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf'
    ),
    bold: obterFontePdf(
        'C:\\Windows\\Fonts\\arialbd.ttf',
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
        '/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf'
    ),
};

exports.exportarChamadosPdf = async (req, res) => {
    const status = String(req.query.status || 'todos').toLowerCase();
    const filtros = {
        todos: { titulo: 'Todos os chamados', clausula: '', valores: [] },
        abertos: { titulo: 'Chamados abertos', clausula: 'WHERE chamados.status = ?', valores: ['Aberto'] },
        fechados: { titulo: 'Chamados fechados', clausula: 'WHERE chamados.status = ?', valores: ['Fechado'] },
    };
    if (!filtros[status]) return res.status(400).json({ error: 'Status de exportação inválido.' });

    const filtro = filtros[status];
    const sql = `
        SELECT chamados.idChamado, chamados.descricao, chamados.status, chamados.dataEntrada, chamados.dataSaida,
               tablets.idTomb, usuarios.nomeUser, unidades.nomeUnidade, regionais.numReg AS nomeRegional
        FROM chamados
        JOIN tablets ON chamados.idTab = tablets.idTab
        LEFT JOIN usuarios ON tablets.idUser = usuarios.idUser
        LEFT JOIN unidades ON usuarios.idUnidade = unidades.idUnidade
        LEFT JOIN regionais ON unidades.idReg = regionais.idReg
        ${filtro.clausula}
        ORDER BY COALESCE(regionais.numReg, 'Sem regional'), chamados.dataEntrada DESC, chamados.idChamado DESC
    `;

    try {
        const [chamados] = await db.query(sql, filtro.valores);
        const porRegional = chamados.reduce((grupos, chamado) => {
            const regional = normalizarTextoPdf(chamado.nomeRegional, 'Sem regional vinculada');
            (grupos[regional] ||= []).push(chamado);
            return grupos;
        }, {});
        const resumoStatus = chamados.reduce((totais, chamado) => {
            const statusChamado = normalizarTextoPdf(chamado.status, 'Sem status');
            totais[statusChamado] = (totais[statusChamado] || 0) + 1;
            return totais;
        }, {});
        const resumoMesAno = chamados.reduce((totais, chamado) => {
            const mesAno = formatarMesAnoPdf(chamado.dataEntrada);
            totais[mesAno] = (totais[mesAno] || 0) + 1;
            return totais;
        }, {});
        const resumoRegionais = Object.entries(porRegional).map(([nome, lista]) => ({ nome, quantidade: lista.length }));
        const resumoPeriodos = Object.entries(resumoMesAno).map(([nome, quantidade]) => ({ nome, quantidade }));
        const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 36, bufferPages: true });
        const paginasSemRodape = new Set();
        const nomeArquivo = `relatorio-chamados-${status}-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
        doc.pipe(res);
        if (fontePdf.regular) doc.registerFont('FonteRegular', fontePdf.regular);
        if (fontePdf.bold) doc.registerFont('FonteBold', fontePdf.bold);
        const fonteRegular = fontePdf.regular ? 'FonteRegular' : 'Helvetica';
        const fonteBold = fontePdf.bold ? 'FonteBold' : 'Helvetica-Bold';

        const largura = doc.page.width - doc.page.margins.left - doc.page.margins.right;
        const inicioX = doc.page.margins.left;
        const colunas = [
            ['id', 'ID', 38], ['tablet', 'TABLET', 76], ['usuario', 'USUÁRIO', 132], ['unidade', 'UNIDADE', 125],
            ['entrada', 'ENTRADA', 62], ['saida', 'SAÍDA', 62], ['status', 'STATUS', 65], ['descricao', 'DESCRIÇÃO', largura - 560],
        ];
        const cabecalho = () => {
            const y = doc.page.margins.top;
            doc.rect(inicioX, y, largura, 48).fill('#0948A7');
            doc.rect(inicioX + largura * 0.55, y, largura * 0.45, 48).fill('#298ED3');
            doc.fillColor('#FFFFFF').font(fonteBold).fontSize(18).text('SysTAB', inicioX + 16, y + 10);
            doc.font(fonteRegular).fontSize(10).text('Relatório de chamados', inicioX + 16, y + 31);
            doc.font(fonteBold).fontSize(12).text(filtro.titulo, inicioX + largura - 210, y + 12, { width: 194, align: 'right' });
            doc.font(fonteRegular).fontSize(8).text(`Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, inicioX + largura - 210, y + 30, { width: 194, align: 'right' });
            return y + 66;
        };
        const calcularAlturaPainelResumo = (quantidadeItens) => {
            const colunasResumo = 3;
            const chipAltura = 17;
            const linhas = Math.max(1, Math.ceil(quantidadeItens / colunasResumo));
            return 33 + linhas * chipAltura + Math.max(0, linhas - 1) * 5;
        };
        const desenharPainelResumo = (titulo, itens, x, y, larguraPainel, alturaPainel) => {
            doc.roundedRect(x, y, larguraPainel, alturaPainel, 6).fill('#F8FAFC').strokeColor('#E2E8F0').lineWidth(0.5).stroke();
            doc.fillColor('#334155').font(fonteBold).fontSize(8).text(titulo, x + 10, y + 8);
            const colunasResumo = 3;
            const chipGap = 6;
            const chipLargura = (larguraPainel - 20 - (chipGap * (colunasResumo - 1))) / colunasResumo;
            const chipAltura = 17;
            itens.forEach((item, indice) => {
                const coluna = indice % colunasResumo;
                const linha = Math.floor(indice / colunasResumo);
                const chipX = x + 10 + coluna * (chipLargura + chipGap);
                const chipY = y + 25 + linha * (chipAltura + 5);
                doc.roundedRect(chipX, chipY, chipLargura, chipAltura, 4).fill('#FFFFFF').strokeColor('#E5E7EB').lineWidth(0.4).stroke();
                doc.fillColor('#0948A7').font(fonteBold).fontSize(7).text(String(item.quantidade), chipX + 5, chipY + 5, { width: 22, align: 'left' });
                doc.fillColor('#475569').font(fonteRegular).fontSize(6.5).text(String(item.nome), chipX + 28, chipY + 5, { width: chipLargura - 33, height: 8, ellipsis: true });
            });
            if (!itens.length) {
                doc.fillColor('#64748B').font(fonteRegular).fontSize(7).text('Sem registros', x + 10, y + 30, { width: larguraPainel - 20 });
            }
            return y + alturaPainel;
        };
        const resumoDocumento = (y) => {
            const painelGap = 10;
            const larguraPainel = (largura - 28 - painelGap) / 2;
            const alturaPainelRegional = calcularAlturaPainelResumo(resumoRegionais.length);
            const alturaPainelPeriodo = calcularAlturaPainelResumo(resumoPeriodos.length);
            const alturaPaineis = Math.max(alturaPainelRegional, alturaPainelPeriodo);
            const alturaResumo = 94 + alturaPaineis + 18;
            if (y + alturaResumo > doc.page.height - doc.page.margins.bottom) { doc.addPage(); y = cabecalho(); }
            const painelY = y + 94;
            doc.roundedRect(inicioX, y, largura, alturaResumo, 8).fill('#FFFFFF').strokeColor('#DCEAF7').lineWidth(0.8).stroke();
            doc.rect(inicioX, y, 5, alturaResumo).fill('#298ED3');
            doc.fillColor('#0948A7').font(fonteBold).fontSize(12).text('Resumo do documento', inicioX + 14, y + 12);
            doc.fillColor('#64748B').font(fonteRegular).fontSize(8).text('Quantitativo dos chamados presentes neste PDF', inicioX + 14, y + 28);
            const cards = [
                ['Total', chamados.length, '#0948A7'],
                ['Abertos', resumoStatus.Aberto || 0, '#0369A1'],
                ['Fechados', resumoStatus.Fechado || 0, '#15803D'],
                ['Regionais', resumoRegionais.length, '#7C3AED'],
                ['Períodos', resumoPeriodos.length, '#EA580C'],
            ];
            const espaco = 8;
            const larguraCard = (largura - 28 - (espaco * (cards.length - 1))) / cards.length;
            cards.forEach(([titulo, valor, cor], indice) => {
                const cardX = inicioX + 14 + indice * (larguraCard + espaco);
                doc.roundedRect(cardX, y + 45, larguraCard, 38, 6).fill('#F8FAFC').strokeColor('#E2E8F0').lineWidth(0.5).stroke();
                doc.fillColor(cor).font(fonteBold).fontSize(14).text(String(valor), cardX + 8, y + 52, { width: larguraCard - 16, align: 'center' });
                doc.fillColor('#64748B').font(fonteRegular).fontSize(7).text(titulo, cardX + 8, y + 69, { width: larguraCard - 16, align: 'center' });
            });
            desenharPainelResumo('Chamados por regional', resumoRegionais, inicioX + 14, painelY, larguraPainel, alturaPainelRegional);
            desenharPainelResumo('Chamados por mês/ano', resumoPeriodos, inicioX + 14 + larguraPainel + painelGap, painelY, larguraPainel, alturaPainelPeriodo);
            return y + alturaResumo + 16;
        };
        const tituloRegional = (regional, quantidade, y) => {
            doc.roundedRect(inicioX, y, largura, 26, 5).fill('#EAF4FC');
            doc.fillColor('#0948A7').font(fonteBold).fontSize(11).text(`Regional ${regional}`, inicioX + 10, y + 8);
            doc.fillColor('#4B5563').font(fonteRegular).fontSize(9).text(`${quantidade} chamado${quantidade === 1 ? '' : 's'}`, inicioX + largura - 100, y + 8, { width: 90, align: 'right' });
            return y + 34;
        };
        const tituloMesAno = (mesAno, quantidade, y) => {
            doc.roundedRect(inicioX + 10, y, largura - 20, 24, 4).fill('#F8FAFC');
            doc.rect(inicioX + 10, y, 4, 24).fill('#298ED3');
            doc.fillColor('#1E3A8A').font(fonteBold).fontSize(10).text(mesAno, inicioX + 22, y + 7);
            doc.fillColor('#64748B').font(fonteRegular).fontSize(8).text(`${quantidade} chamado${quantidade === 1 ? '' : 's'}`, inicioX + largura - 116, y + 8, { width: 96, align: 'right' });
            return y + 31;
        };
        const cabecalhoTabela = (y) => {
            doc.rect(inicioX, y, largura, 21).fill('#0948A7');
            let x = inicioX;
            colunas.forEach(([, titulo, colunaLargura]) => {
                doc.fillColor('#FFFFFF').font(fonteBold).fontSize(7).text(titulo, x + 5, y + 7, { width: colunaLargura - 8, lineBreak: false });
                x += colunaLargura;
            });
            return y + 21;
        };

        let y = cabecalho();
        const regionais = Object.entries(porRegional);
        y = resumoDocumento(y);
        if (regionais.length) { doc.addPage(); paginasSemRodape.add(doc.bufferedPageRange().count - 1); doc.addPage(); y = cabecalho(); }
        if (!regionais.length) doc.fillColor('#6B7280').font(fonteRegular).fontSize(12).text('Nenhum chamado encontrado para este recorte.', inicioX, y + 24, { width: largura, align: 'center' });
        regionais.forEach(([regional, chamadosRegional], indiceRegional) => {
            if (y + 82 > doc.page.height - doc.page.margins.bottom) { doc.addPage(); y = cabecalho(); }
            if (indiceRegional > 0) y += 8;
            y = tituloRegional(regional, chamadosRegional.length, y);
            const porMesAno = chamadosRegional.reduce((grupos, chamado) => {
                const mesAno = formatarMesAnoPdf(chamado.dataEntrada);
                (grupos[mesAno] ||= []).push(chamado);
                return grupos;
            }, {});
            Object.entries(porMesAno).forEach(([mesAno, chamadosMes], indiceMes) => {
                if (y + 76 > doc.page.height - doc.page.margins.bottom) {
                    doc.addPage(); y = cabecalho(); y = tituloRegional(`${regional} (continuação)`, chamadosRegional.length, y);
                }
                if (indiceMes > 0) y += 5;
                y = cabecalhoTabela(tituloMesAno(mesAno, chamadosMes.length, y));
                chamadosMes.forEach((chamado, indice) => {
                    const valores = {
                        id: `#${chamado.idChamado}`, tablet: normalizarTextoPdf(chamado.idTomb), usuario: normalizarTextoPdf(chamado.nomeUser, 'Não informado'),
                        unidade: normalizarTextoPdf(chamado.nomeUnidade, 'Não informada'), entrada: formatarDataPdf(chamado.dataEntrada),
                        saida: formatarDataPdf(chamado.dataSaida), status: normalizarTextoPdf(chamado.status), descricao: normalizarTextoPdf(chamado.descricao, 'Sem descrição'),
                    };
                    const colunaUnidade = colunas.find(([chave]) => chave === 'unidade');
                    doc.font(fonteRegular).fontSize(7.5);
                    const alturaUnidade = doc.heightOfString(valores.unidade, { width: colunaUnidade[2] - 10, lineGap: 1 });
                    const altura = Math.max(30, Math.ceil(alturaUnidade + 14));
                    if (y + altura > doc.page.height - doc.page.margins.bottom) {
                        doc.addPage(); y = cabecalho(); y = tituloRegional(`${regional} (continuação)`, chamadosRegional.length, y); y = cabecalhoTabela(tituloMesAno(`${mesAno} (continuação)`, chamadosMes.length, y));
                    }
                    doc.rect(inicioX, y, largura, altura).fill(indice % 2 === 0 ? '#F8FAFC' : '#FFFFFF');
                    let x = inicioX;
                    colunas.forEach(([chave, , colunaLargura]) => {
                        const cor = chave === 'status' ? (chamado.status === 'Fechado' ? '#15803D' : '#0369A1') : '#334155';
                        const opcoesTexto = chave === 'unidade'
                            ? { width: colunaLargura - 10, height: altura - 12, lineGap: 1 }
                            : { width: colunaLargura - 10, height: 17, ellipsis: true, lineBreak: false };
                        doc.fillColor(cor).font(chave === 'id' ? fonteBold : fonteRegular).fontSize(7.5).text(valores[chave], x + 5, y + 7, opcoesTexto);
                        x += colunaLargura;
                    });
                    doc.moveTo(inicioX, y + altura).lineTo(inicioX + largura, y + altura).strokeColor('#E5E7EB').lineWidth(0.5).stroke();
                    y += altura;
                });
            });
        });
        const paginas = doc.bufferedPageRange();
        for (let indice = 0; indice < paginas.count; indice += 1) {
            doc.switchToPage(indice);
            if (paginasSemRodape.has(indice)) continue;
            const rodapeY = doc.page.height - doc.page.margins.bottom - 10;
            doc.fillColor('#64748B').font(fonteRegular).fontSize(7).text('SysTAB - ' + filtro.titulo, inicioX, rodapeY).text('Página ' + (indice + 1) + ' de ' + paginas.count, inicioX, rodapeY, { width: largura, align: 'right' });
        }
        doc.end();
    } catch (err) {
        console.error('Erro ao exportar chamados em PDF:', err);
        if (!res.headersSent) return res.status(500).json({ error: 'Não foi possível gerar o relatório em PDF.' });
        res.end();
    }
};

exports.buscarChamadoPorIdChamado = async (req, res) => {
    const { id } = req.params;
    const sql = `
        SELECT chamados.*, tablets.*, usuarios.nomeUser, usuarios.telUser, unidades.nomeUnidade, regionais.numReg AS nomeRegional, empresas.nomeEmp
        FROM chamados
        JOIN tablets ON chamados.idTab = tablets.idTab
        LEFT JOIN usuarios ON tablets.idUser = usuarios.idUser
        LEFT JOIN unidades ON usuarios.idUnidade = unidades.idUnidade
        LEFT JOIN regionais ON unidades.idReg = regionais.idReg
        LEFT JOIN empresas ON tablets.idEmp = empresas.idEmp
        WHERE chamados.idChamado = ?
    `;
    try {
        const [results] = await db.query(sql, [id]);
        if (results.length === 0) return res.status(404).json({ mensagem: 'Chamado nÃƒÆ’Ã‚Â£o encontrado' });
        res.json(results[0]);
    } catch (err) {
        res.status(500).json(err);
    }
};

exports.listarChamadosAtrasados = async (req, res) => {
    const dias = parseInt(req.query.dias) || 7;
    try {
        const [rows] = await db.query(
            `SELECT * FROM chamados 
            WHERE status = 'Aberto' AND dataEntrada < DATE_SUB(NOW(), INTERVAL ? DAY)`,
            [dias]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: 'Erro ao buscar chamados antigos.', error: err });
    }
};



exports.listarPorTablet = async (req, res) => {
    const { id } = req.params;
    const sql = `
    SELECT idChamado, dataEntrada, dataSaida, descricao, status,
    DATEDIFF(CURDATE(), dataEntrada) AS diasAberto
    FROM chamados
    WHERE idTab = ?
    ORDER BY dataEntrada DESC
    `;
    try {
        const [result] = await db.query(sql, [id]);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: "Erro ao buscar chamados." });
    }
};


// Deletar chamado

exports.deletarChamado = async (req, res) => {
    const { id } = req.params;
    const sql = 'DELETE FROM chamados WHERE idChamado = ?';
    try {
        const [result] = await db.query(sql, [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Chamado nÃƒÆ’Ã‚Â£o encontrado." });
        }
        res.json({ message: "Chamado deletado com sucesso." });
    } catch (err) {
        console.error("Error deleting chamado:", err);
        res.status(500).json({ error: "Erro ao deletar chamado." });
    }
};

// Function to update a chamado

exports.atualizarChamado = async (req, res) => {
    const { id } = req.params;
    // Only allow fields that exist in chamados table
    const allowedFields = ["idTab", "status", "item", "descricao", "dataSaida", "itensRecebidos"];
    const updates = [];
    const values = [];
    for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
            let dbField = field;
            if (field === "itensRecebidos") dbField = "item";
            updates.push(`${dbField} = ?`);
            values.push(req.body[field]);
        }
    }
    if (updates.length === 0) {
        return res.status(400).json({ error: "Nenhum campo vÃƒÆ’Ã‚Â¡lido para atualizar." });
    }
    const sql = `UPDATE chamados SET ${updates.join(", ")} WHERE idChamado = ?`;
    values.push(id);
    try {
        const [result] = await db.query(sql, values);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Chamado nÃƒÆ’Ã‚Â£o encontrado." });
        }
        res.json({ message: "Chamado atualizado com sucesso." });
    } catch (err) {
        console.error("Erro ao atualizar chamado:", err);
        res.status(500).json({ error: "Erro ao atualizar chamado." });
    }
};

// Function to close a chamado (without resolucao)

exports.fecharChamado = async (req, res) => {
    const { id } = req.params;
    const sql = 'UPDATE chamados SET status = "Fechado", dataSaida = NOW() WHERE idChamado = ?';
    try {
        const [result] = await db.query(sql, [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Chamado nÃƒÆ’Ã‚Â£o encontrado." });
        }
        res.json({ message: "Chamado fechado com sucesso." });
    } catch (err) {
        console.error("Erro ao fechar chamado:", err);
        res.status(500).json({ error: "Erro ao fechar chamado." });
    }
};

// Function to reopen a chamado

exports.reabrirChamado = async (req, res) => {
    const { id } = req.params;
    const sql = 'UPDATE chamados SET status = "Aberto", dataSaida = NULL WHERE idChamado = ?';
    try {
        const [result] = await db.query(sql, [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Chamado nÃƒÆ’Ã‚Â£o encontrado." });
        }
        res.json({ message: "Chamado reaberto com sucesso." });
    } catch (err) {
        console.error("Erro ao reabrir chamado:", err);
        res.status(500).json({ error: "Erro ao reabrir chamado." });
    }
};


exports.gerarOS = async (req, res) => {
    const { id, tipo } = req.params;
    const caminhoModelo = path.join(__dirname, `../../templates/template${tipo.toUpperCase()}.docx`);
    if (!fs.existsSync(caminhoModelo)) {
        return res.status(400).json({
            erro: `Modelo de O.S. '${tipo.toUpperCase()}' nÃƒÆ’Ã‚Â£o encontrado. Verifique se o arquivo 'template${tipo.toUpperCase()}.docx' existe na pasta templates.`
        });
    }
    const sql = `
        SELECT 
            chamados.idChamado, chamados.descricao, chamados.dataEntrada, chamados.item,
            tablets.idTomb, tablets.imei, 
            usuarios.nomeUser, usuarios.telUser, usuarios.cpf, 
            unidades.nomeUnidade, 
            regionais.numReg AS nomeRegional, 
            empresas.nomeEmp, empresas.idEmp
        FROM chamados
        JOIN tablets ON chamados.idTab = tablets.idTab
        JOIN usuarios ON tablets.idUser = usuarios.idUser
        LEFT JOIN unidades ON usuarios.idUnidade = unidades.idUnidade
        LEFT JOIN regionais ON unidades.idReg = regionais.idReg
        LEFT JOIN empresas ON tablets.idEmp = empresas.idEmp
        WHERE chamados.idChamado = ?
    `;
    try {
        const [results] = await db.query(sql, [id]);
        if (results.length === 0) return res.status(404).json({ mensagem: 'Chamado nÃƒÆ’Ã‚Â£o encontrado' });
        const data = results[0];
        const conteudo = fs.readFileSync(caminhoModelo, 'binary');
        const zip = new PizZip(conteudo);
        const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
        const meses = [
            "Janeiro", "Fevereiro", "MarÃƒÆ’Ã‚Â§o", "Abril", "Maio", "Junho",
            "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
        ];
        const hoje = new Date();
        const dataHoje = `JaboatÃƒÆ’Ã‚Â£o dos Guararapes, ${hoje.getDate()} de ${meses[hoje.getMonth()]
            } de ${hoje.getFullYear()}`;
        const dia = format(hoje, 'dd', { locale: ptBR });
        const mes = format(hoje, 'MMMM', { locale: ptBR });
        const ano = format(hoje, 'yyyy', { locale: ptBR });
        const dataToSet = {
            dia,
            mes,
            ano,
            dataHoje,
            nomeUser: data.nomeUser,
            telUser: data.telUser || '',
            cpf: data.cpf,
            tombamento: data.idTomb,
            imei: data.imei,
            regional: data.nomeRegional,
            unidade: data.nomeUnidade,
            empresa: data.idEmp,
            item: data.item,
            idChamado: data.idChamado,
            descricao: data.descricao,
            dataEntrada: data.dataEntrada
                ? format(new Date(data.dataEntrada), 'dd/MM/yyyy', { locale: ptBR })
                : 'Data nÃƒÆ’Ã‚Â£o disponÃƒÆ’Ã‚Â­vel', // Fallback value
        };
        try {
            doc.render(dataToSet);
        } catch (erro) {
            return res.status(500).json({ erro: 'Erro ao renderizar documento', detalhes: erro });
        }
        const buffer = doc.getZip().generate({ type: 'nodebuffer' });
        const nomeArquivo = `OS_${tipo.toUpperCase()}_${data.tombamento}_${Date.now()}.docx`;
        const caminhoFinal = path.join(__dirname, `../../output/${nomeArquivo}`);
        fs.writeFileSync(caminhoFinal, buffer);
        res.download(caminhoFinal);
    } catch (err) {
        res.status(500).json(err);
    }
};
