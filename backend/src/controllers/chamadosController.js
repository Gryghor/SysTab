const db = require('../config/db');
const path = require('path');
const fs = require('fs');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const { format } = require('date-fns');
const { ptBR } = require('date-fns/locale');
const { registrarLog } = require('../utils/logger');


exports.criarChamado = async (req, res) => {
    const { idTab, descricao, item } = req.body;
    if (!idTab || !descricao) {
        return res.status(400).json({ error: "Tablet e descrição são obrigatórios." });
    }
    const sql = `
        INSERT INTO chamados
        (idTab, descricao, item, status, dataEntrada, idUserOriginal, nomeUserSnapshot,
         telUserSnapshot, cpfSnapshot, idUnidadeSnapshot, nomeUnidadeSnapshot, regionalSnapshot,
         idLoginCriador, nomeCriadorSnapshot)
        SELECT t.idTab, ?, ?, 'Aberto', NOW(), t.idUser, u.nomeUser, u.telUser, u.cpf,
               u.idUnidade, un.nomeUnidade, r.numReg, criador.idLogin, criador.nome
        FROM tablets t
        LEFT JOIN usuarios u ON u.idUser = t.idUser
        LEFT JOIN unidades un ON un.idUnidade = u.idUnidade
        LEFT JOIN regionais r ON r.idReg = un.idReg
        LEFT JOIN login criador ON criador.idLogin = ?
        WHERE t.idTab = ?
    `;
    try {
        const [result] = await db.query(sql, [descricao, item, Number(req.usuario.idLogin), idTab]);
        if (result.affectedRows === 0) {
            return res.status(400).json({ error: "Tablet não encontrado." });
        }

        await registrarLog({
            acao: "CRIACAO",
            entidade: "chamado",
            entidadeId: result.insertId,
            req,
            detalhes: { idTab, item, descricao, idLoginCriador: Number(req.usuario.idLogin) },
        });

        res.status(201).json({ message: "Chamado criado com sucesso.", idChamado: result.insertId });
    } catch (err) {
        console.error("Error creating chamado:", err);
        res.status(500).json({ error: "Erro ao criar chamado." });
    }
};


exports.listarChamados = async (req, res) => {
    const sql = `
        SELECT c.*, t.idTomb, t.imei,
               COALESCE(c.nomeUserSnapshot, usuarioAtual.nomeUser) AS nomeUser,
               COALESCE(c.telUserSnapshot, usuarioAtual.telUser) AS telUser
        FROM chamados c
        JOIN tablets t ON c.idTab = t.idTab
        LEFT JOIN usuarios usuarioAtual ON t.idUser = usuarioAtual.idUser
    `;
    try {
        const [results] = await db.query(sql);
        res.json(results);
    } catch (err) {
        res.status(500).json(err);
    }
};


exports.buscarChamadoPorIdChamado = async (req, res) => {
    const { id } = req.params;
    const sql = `
        SELECT c.*, t.*,
               COALESCE(c.nomeUserSnapshot, usuarioAtual.nomeUser) AS nomeUser,
               COALESCE(c.telUserSnapshot, usuarioAtual.telUser) AS telUser,
               COALESCE(c.nomeUnidadeSnapshot, unidadeAtual.nomeUnidade) AS nomeUnidade,
               COALESCE(c.regionalSnapshot, regionalAtual.numReg) AS nomeRegional,
               e.nomeEmp
        FROM chamados c
        JOIN tablets t ON c.idTab = t.idTab
        LEFT JOIN usuarios usuarioAtual ON t.idUser = usuarioAtual.idUser
        LEFT JOIN unidades unidadeAtual ON usuarioAtual.idUnidade = unidadeAtual.idUnidade
        LEFT JOIN regionais regionalAtual ON unidadeAtual.idReg = regionalAtual.idReg
        LEFT JOIN empresas e ON t.idEmp = e.idEmp
        WHERE c.idChamado = ?
    `;
    try {
        const [results] = await db.query(sql, [id]);
        if (results.length === 0) return res.status(404).json({ mensagem: 'Chamado não encontrado' });
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
    try {
        const [rows] = await db.query('SELECT * FROM chamados WHERE idChamado = ?', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: "Chamado não encontrado." });
        }
        await db.query('DELETE FROM chamados WHERE idChamado = ?', [id]);

        await registrarLog({
            acao: "EXCLUSAO",
            entidade: "chamado",
            entidadeId: Number(id),
            req,
            detalhes: rows[0],
        });

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
    const allowedFields = ["status", "item", "descricao", "dataSaida", "itensRecebidos"];
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
        return res.status(400).json({ error: "Nenhum campo válido para atualizar." });
    }
    const sql = `UPDATE chamados SET ${updates.join(", ")} WHERE idChamado = ?`;
    values.push(id);
    try {
        const [result] = await db.query(sql, values);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Chamado não encontrado." });
        }

        await registrarLog({
            acao: "EDICAO",
            entidade: "chamado",
            entidadeId: Number(id),
            req,
            detalhes: req.body,
        });

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
            return res.status(404).json({ error: "Chamado não encontrado." });
        }

        await registrarLog({ acao: "FECHAMENTO", entidade: "chamado", entidadeId: Number(id), req });

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
            return res.status(404).json({ error: "Chamado não encontrado." });
        }

        await registrarLog({ acao: "REABERTURA", entidade: "chamado", entidadeId: Number(id), req });

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
            erro: `Modelo de O.S. '${tipo.toUpperCase()}' não encontrado. Verifique se o arquivo 'template${tipo.toUpperCase()}.docx' existe na pasta templates.`
        });
    }
    const sql = `
        SELECT 
            c.idChamado, c.descricao, c.dataEntrada, c.item,
            t.idTomb, t.imei,
            COALESCE(c.nomeUserSnapshot, usuarioAtual.nomeUser) AS nomeUser,
            COALESCE(c.telUserSnapshot, usuarioAtual.telUser) AS telUser,
            COALESCE(c.cpfSnapshot, usuarioAtual.cpf) AS cpf,
            COALESCE(c.nomeUnidadeSnapshot, unidadeAtual.nomeUnidade) AS nomeUnidade,
            COALESCE(c.regionalSnapshot, regionalAtual.numReg) AS nomeRegional,
            e.nomeEmp, e.idEmp
        FROM chamados c
        JOIN tablets t ON c.idTab = t.idTab
        LEFT JOIN usuarios usuarioAtual ON t.idUser = usuarioAtual.idUser
        LEFT JOIN unidades unidadeAtual ON usuarioAtual.idUnidade = unidadeAtual.idUnidade
        LEFT JOIN regionais regionalAtual ON unidadeAtual.idReg = regionalAtual.idReg
        LEFT JOIN empresas e ON t.idEmp = e.idEmp
        WHERE c.idChamado = ?
    `;
    try {
        const [results] = await db.query(sql, [id]);
        if (results.length === 0) return res.status(404).json({ mensagem: 'Chamado não encontrado' });
        const data = results[0];
        const conteudo = fs.readFileSync(caminhoModelo, 'binary');
        const zip = new PizZip(conteudo);
        const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
        const meses = [
            "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
            "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
        ];
        const hoje = new Date();
        const dataHoje = `Jaboatão dos Guararapes, ${hoje.getDate()} de ${meses[hoje.getMonth()]
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
                : 'Data não disponível', // Fallback value
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
