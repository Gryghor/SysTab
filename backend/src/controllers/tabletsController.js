const db = require("../config/db");
const path = require("path");
const fs = require("fs");
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const { registrarLog } = require("../utils/logger");
const { mapDbError } = require("../utils/dbErrors");

// GERAR TERMO DE RESPONSABILIDADE
exports.gerarTermoResponsabilidade = async (req, res) => {
    const { id } = req.params; // idTab
    const caminhoModelo = path.join(__dirname, '../../templates/templateRESPONSABILIDADE.docx');
    if (!fs.existsSync(caminhoModelo)) {
        return res.status(400).json({ erro: `Modelo de termo de responsabilidade não encontrado.` });
    }
    // Buscar tablet, usuário, unidade, regional
    const sql = `
        SELECT t.idTomb, t.imei, u.nomeUser, u.cpf, un.nomeUnidade, r.numReg AS regional
        FROM tablets t
        JOIN usuarios u ON t.idUser = u.idUser
        LEFT JOIN unidades un ON u.idUnidade = un.idUnidade
        LEFT JOIN regionais r ON un.idReg = r.idReg
        WHERE t.idTab = ?
    `;
    try {
        const [results] = await db.query(sql, [id]);
        if (results.length === 0) return res.status(404).json({ mensagem: 'Tablet não encontrado' });
        const data = results[0];
        if (!data.nomeUser) {
            return res.status(400).json({ erro: 'Não é possível gerar termo: tablet sem usuário vinculado.' });
        }
        const conteudo = fs.readFileSync(caminhoModelo, 'binary');
        const zip = new PizZip(conteudo);
        const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
        const meses = [
            "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
            "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
        ];
        const hoje = new Date();
        const dataHoje = `Jaboatão dos Guararapes, ${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}`;
        const dataToSet = {
            dataHoje,
            unidade: data.nomeUnidade || '',
            regional: data.regional || '',
            tombamento: data.idTomb || '',
            imei: data.imei || '',
            nomeUser: data.nomeUser || '',
            cpf: data.cpf || '',
        };
        try {
            doc.render(dataToSet);
        } catch (erro) {
            return res.status(500).json({ erro: 'Erro ao renderizar documento', detalhes: erro });
        }
        const buffer = doc.getZip().generate({ type: 'nodebuffer' });
        const nomeArquivo = `TERMO_RESPONSABILIDADE_${data.idTomb}_${Date.now()}.docx`;
        const caminhoFinal = path.join(__dirname, `../../output/${nomeArquivo}`);
        fs.writeFileSync(caminhoFinal, buffer);
        res.download(caminhoFinal);
    } catch (err) {
        res.status(500).json(err);
    }
};
// CRIAR TABLET
exports.criarTablet = async (req, res) => {
    const { idTomb, imei, idUser, idEmp } = req.body;
    if (!idTomb || !imei || !idEmp) {
        return res.status(400).json({ error: "Campos obrigatórios: idTomb, imei, idEmp." });
    }
    try {
        let userToInsert = null;
        let nomeUserVinculado = null;
        if (idUser) {
            // Get user name
            const [userRows] = await db.query("SELECT nomeUser FROM usuarios WHERE idUser = ?", [idUser]);
            const nomeUser = userRows[0]?.nomeUser;
            if (!nomeUser) {
                return res.status(400).json({ error: "Usuário não encontrado." });
            }
            // Only allow multiple tablets for 'Não Cadastrado'
            if (nomeUser !== "Não Cadastrado") {
                const [verifResult] = await db.query("SELECT idTab, idTomb FROM tablets WHERE idUser = ?", [idUser]);
                if (verifResult.length > 0) {
                    return res.status(400).json({
                        error: `${nomeUser} já possui o tablet #${verifResult[0].idTomb} vinculado. Use "Remanejar" no tablet atual para transferi-lo para este usuário.`,
                    });
                }
            }
            userToInsert = idUser;
            nomeUserVinculado = nomeUser;
        }
        const sql = "INSERT INTO tablets (idTomb, imei, idUser, idEmp) VALUES (?, ?, ?, ?)";
        const [result] = await db.query(sql, [idTomb, imei, userToInsert, idEmp]);

        registrarLog({
            acao: "CRIACAO",
            entidade: "tablet",
            entidadeId: result.insertId,
            req,
            detalhes: { idTomb, imei, idEmp, idUser: userToInsert, nomeUser: nomeUserVinculado },
        });

        res.status(201).json({ message: "Tablet criado com sucesso.", idTab: result.insertId });
    } catch (err) {
        const msg = mapDbError(err, {
            duplicateFields: {
                imei: "Este IMEI já está cadastrado em outro tablet.",
                idTomb: "Este Tombamento já está cadastrado em outro tablet.",
                idUser: "Este usuário já possui outro tablet vinculado. Use \"Remanejar\" para transferir.",
            },
            fallback: "Erro ao criar tablet.",
        });
        res.status(err?.code === "ER_DUP_ENTRY" ? 409 : 500).json({ error: msg });
    }
};

// LISTAR TABLETS
exports.listarTablets = async (req, res) => {
    const { unidade } = req.query;
    let sql = `
        SELECT t.*, u.nomeUser AS usuario, un.nomeUnidade AS unidade, r.numReg AS regional, e.nomeEmp AS empresa
        FROM tablets t
        LEFT JOIN usuarios u ON t.idUser = u.idUser
        LEFT JOIN unidades un ON u.idUnidade = un.idUnidade
        LEFT JOIN regionais r ON un.idReg = r.idReg
        LEFT JOIN empresas e ON t.idEmp = e.idEmp
    `;
    let params = [];
    if (unidade) {
        sql += ' WHERE u.idUnidade = ?';
        params.push(unidade);
    }
    try {
        const [result] = await db.query(sql, params);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: "Erro ao listar tablets." });
    }
};


// BUSCAR TABLET POR TOMBAMENTO OU IMEI
exports.buscarTablet = async (req, res) => {
    const { tombamento, imei } = req.query;
    if (!tombamento && !imei) {
        return res.status(400).json({ error: "Informe tombamento ou IMEI." });
    }
    const sql = `
    SELECT t.*, u.nomeUser AS usuario, un.nomeUnidade AS unidade, r.numReg AS regional, e.nomeEmp AS empresa
    FROM tablets t
    JOIN usuarios u ON t.idUser = u.idUser
    JOIN unidades un ON u.idUnidade = un.idUnidade
    JOIN regionais r ON un.idReg = r.idReg
    JOIN empresas e ON t.idEmp = e.idEmp
    WHERE t.idTomb = ? OR t.imei = ?
    `;
    try {
        const [result] = await db.query(sql, [tombamento, imei]);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: "Erro na busca." });
    }
};

// BUSCAR TABLET POR ID
exports.buscarTablet = async (req, res) => {
    const { tombamento, imei } = req.query;
    if (!tombamento && !imei) {
        return res.status(400).json({ error: "Informe tombamento ou IMEI." });
    }
    const sql = `
    SELECT t.*, u.nomeUser AS usuario, un.nomeUnidade AS unidade, r.numReg AS regional, e.nomeEmp AS empresa
    FROM tablets t
    JOIN usuarios u ON t.idUser = u.idUser
    JOIN unidades un ON u.idUnidade = un.idUnidade
    JOIN regionais r ON un.idReg = r.idReg
    JOIN empresas e ON t.idEmp = e.idEmp
    WHERE t.idTomb = ? OR t.imei = ?
    `;
    try {
        const [result] = await db.query(sql, [tombamento, imei]);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: "Erro na busca." });
    }
};


// BUSCAR TABLET POR ID
exports.buscarTabletPorId = async (req, res) => {
    const { id } = req.params;
    const sql = `
    SELECT t.*, u.nomeUser, u.telUser, un.nomeUnidade, r.numReg, e.nomeEmp
    FROM tablets t
    LEFT JOIN usuarios u ON t.idUser = u.idUser
    LEFT JOIN unidades un ON u.idUnidade = un.idUnidade
    LEFT JOIN regionais r ON un.idReg = r.idReg
    LEFT JOIN empresas e ON t.idEmp = e.idEmp
    WHERE t.idTab = ?
    `;
    try {
        const [result] = await db.query(sql, [id]);
        if (result.length === 0) return res.status(404).json({ error: "Tablet não encontrado." });
        res.json(result[0]);
    } catch (err) {
        res.status(500).json({ error: "Erro ao buscar tablet." });
    }
};


// EDITAR TABLET
exports.editarTablet = async (req, res) => {
    const { id } = req.params;
    const { idTomb, imei, idUser, idEmp } = req.body;
    try {
        const [beforeRows] = await db.query("SELECT * FROM tablets WHERE idTab = ?", [id]);
        if (beforeRows.length === 0) return res.status(404).json({ error: "Tablet não encontrado." });
        const before = beforeRows[0];

        let userToUpdate = null;
        let nomeUserVinculado = null;
        if (idUser === null || idUser === undefined) {
            userToUpdate = null;
        } else {
            // Get user name
            const [userRows] = await db.query("SELECT nomeUser FROM usuarios WHERE idUser = ?", [idUser]);
            const nomeUser = userRows[0]?.nomeUser;
            if (!nomeUser) {
                return res.status(400).json({ error: "Usuário não encontrado." });
            }
            // Only allow multiple tablets for 'Não Cadastrado'
            if (nomeUser !== "Não Cadastrado") {
                const [verifResult] = await db.query("SELECT idTab, idTomb FROM tablets WHERE idUser = ? AND idTab != ?", [idUser, id]);
                if (verifResult.length > 0) {
                    return res.status(400).json({
                        error: `${nomeUser} já possui outro tablet vinculado (#${verifResult[0].idTomb}). Use "Remanejar" para transferir um tablet entre usuários.`,
                    });
                }
            }
            userToUpdate = idUser;
            nomeUserVinculado = nomeUser;
        }
        const sql = `
        UPDATE tablets
        SET idTomb = ?, imei = ?, idUser = ?, idEmp = ?
        WHERE idTab = ?
        `;
        await db.query(sql, [idTomb, imei, userToUpdate, idEmp, id]);

        registrarLog({
            acao: "EDICAO",
            entidade: "tablet",
            entidadeId: Number(id),
            req,
            detalhes: {
                antes: { idTomb: before.idTomb, imei: before.imei, idUser: before.idUser, idEmp: before.idEmp },
                depois: { idTomb, imei, idUser: userToUpdate, nomeUser: nomeUserVinculado, idEmp },
            },
        });

        res.json({ message: "Tablet atualizado com sucesso." });
    } catch (err) {
        const msg = mapDbError(err, {
            duplicateFields: {
                imei: "Este IMEI já está cadastrado em outro tablet.",
                idTomb: "Este Tombamento já está cadastrado em outro tablet.",
                idUser: "Este usuário já possui outro tablet vinculado. Use \"Remanejar\" para transferir.",
            },
            fallback: "Erro ao atualizar tablet.",
        });
        res.status(err?.code === "ER_DUP_ENTRY" ? 409 : 500).json({ error: msg });
    }
}

// REMANEJAR TABLET (transferir para outro usuário, ou desvincular, de forma atômica e auditada)
exports.remanejarTablet = async (req, res) => {
    const { id } = req.params;
    const { idUserDestino, motivo } = req.body;
    const destino = (idUserDestino === undefined || idUserDestino === null || idUserDestino === "")
        ? null
        : idUserDestino;

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const [tabletRows] = await conn.query(
            `SELECT t.*, u.nomeUser AS nomeUserAtual
             FROM tablets t
             LEFT JOIN usuarios u ON t.idUser = u.idUser
             WHERE t.idTab = ? FOR UPDATE`,
            [id]
        );
        if (tabletRows.length === 0) {
            await conn.rollback();
            return res.status(404).json({ error: "Tablet não encontrado." });
        }
        const tablet = tabletRows[0];

        const mesmoDono = (tablet.idUser === null && destino === null) || String(tablet.idUser) === String(destino);
        if (mesmoDono) {
            await conn.rollback();
            return res.status(400).json({ error: "O tablet já está com este usuário." });
        }

        let nomeUserDestino = null;
        if (destino !== null) {
            const [destRows] = await conn.query("SELECT nomeUser FROM usuarios WHERE idUser = ?", [destino]);
            if (destRows.length === 0) {
                await conn.rollback();
                return res.status(400).json({ error: "Usuário de destino não encontrado." });
            }
            nomeUserDestino = destRows[0].nomeUser;

            if (nomeUserDestino !== "Não Cadastrado") {
                const [ownRows] = await conn.query(
                    "SELECT idTab, idTomb FROM tablets WHERE idUser = ? AND idTab != ? FOR UPDATE",
                    [destino, id]
                );
                if (ownRows.length > 0) {
                    await conn.rollback();
                    return res.status(400).json({
                        error: `${nomeUserDestino} já possui o tablet #${ownRows[0].idTomb}. Remaneje esse tablet primeiro, ou escolha outro usuário de destino.`,
                    });
                }
            }
        }

        await conn.query("UPDATE tablets SET idUser = ? WHERE idTab = ?", [destino, id]);
        await conn.commit();

        registrarLog({
            acao: destino === null ? "DESVINCULACAO" : "REMANEJAMENTO",
            entidade: "tablet",
            entidadeId: Number(id),
            req,
            detalhes: {
                idTomb: tablet.idTomb,
                donoAnteriorId: tablet.idUser,
                donoAnteriorNome: tablet.nomeUserAtual,
                donoNovoId: destino,
                donoNovoNome: nomeUserDestino,
                motivo: motivo || null,
            },
        });

        res.json({
            message: destino === null ? "Tablet desvinculado com sucesso." : "Tablet remanejado com sucesso.",
        });
    } catch (err) {
        try { await conn.rollback(); } catch (_) { /* noop */ }
        res.status(500).json({ error: mapDbError(err, { fallback: "Erro ao remanejar tablet." }) });
    } finally {
        conn.release();
    }
};



exports.deletarTablet = async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await db.query("SELECT * FROM tablets WHERE idTab = ?", [id]);
        if (rows.length === 0) return res.status(404).json({ error: "Tablet não encontrado." });

        await db.query("DELETE FROM tablets WHERE idTab = ?", [id]);

        registrarLog({
            acao: "EXCLUSAO",
            entidade: "tablet",
            entidadeId: Number(id),
            req,
            detalhes: rows[0],
        });

        res.json({ message: "Tablet deletado com sucesso." });
    } catch (err) {
        res.status(500).json({ error: mapDbError(err, { fallback: "Erro ao deletar tablet." }) });
    }
};
