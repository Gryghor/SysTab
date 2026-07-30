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
    let conn;
    try {
        conn = await db.getConnection();
        await conn.beginTransaction();
        let userToInsert = null;
        let nomeUserVinculado = null;
        if (idUser) {
            const [userRows] = await conn.query("SELECT nomeUser FROM usuarios WHERE idUser = ? FOR UPDATE", [idUser]);
            const nomeUser = userRows[0]?.nomeUser;
            if (!nomeUser) {
                await conn.rollback();
                return res.status(400).json({ error: "Usuário não encontrado." });
            }
            const [verifResult] = await conn.query("SELECT idTab, idTomb FROM tablets WHERE idUser = ? FOR UPDATE", [idUser]);
            if (verifResult.length > 0) {
                await conn.rollback();
                return res.status(400).json({
                    error: `${nomeUser} já possui o tablet #${verifResult[0].idTomb} vinculado. Use "Remanejar" no tablet atual para transferi-lo para este usuário.`,
                });
            }
            userToInsert = idUser;
            nomeUserVinculado = nomeUser;
        }
        const sql = "INSERT INTO tablets (idTomb, imei, idUser, idEmp) VALUES (?, ?, ?, ?)";
        const [result] = await conn.query(sql, [idTomb, imei, userToInsert, idEmp]);

        if (userToInsert !== null) {
            await conn.query(
                `INSERT INTO tablet_usuario_historico
                 (idTab, idTombSnapshot, idUserAnterior, nomeUserAnterior, idUserNovo, nomeUserNovo,
                  idLoginResponsavel, acao, motivo, rowVersionAnterior, rowVersionNova)
                 VALUES (?, ?, NULL, NULL, ?, ?, ?, 'VINCULACAO_INICIAL', ?, 0, 1)`,
                [result.insertId, idTomb, userToInsert, nomeUserVinculado, req.usuario?.idLogin || null, "Vínculo realizado no cadastro do tablet"]
            );
        }

        await conn.commit();

        await registrarLog({
            acao: "CRIACAO",
            entidade: "tablet",
            entidadeId: result.insertId,
            req,
            detalhes: { idTomb, imei, idEmp, idUser: userToInsert, nomeUser: nomeUserVinculado },
        });

        res.status(201).json({ message: "Tablet criado com sucesso.", idTab: result.insertId });
    } catch (err) {
        if (conn) {
            try { await conn.rollback(); } catch (_) { /* noop */ }
        }
        const msg = mapDbError(err, {
            duplicateFields: {
                imei: "Este IMEI já está cadastrado em outro tablet.",
                idTomb: "Este Tombamento já está cadastrado em outro tablet.",
                idUser: "Este usuário já possui outro tablet vinculado. Use \"Remanejar\" para transferir.",
            },
            fallback: "Erro ao criar tablet.",
        });
        res.status(err?.code === "ER_DUP_ENTRY" ? 409 : 500).json({ error: msg });
    } finally {
        conn?.release();
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
    const { idTomb, imei, idEmp, rowVersion } = req.body;
    if (!idTomb || !imei || !idEmp || !Number.isInteger(Number(rowVersion))) {
        return res.status(400).json({ error: "Campos obrigatórios: idTomb, imei, idEmp e rowVersion." });
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "idUser")) {
        return res.status(400).json({ error: "O vínculo do usuário não pode ser alterado nesta edição. Use Remanejar." });
    }
    try {
        const [beforeRows] = await db.query("SELECT * FROM tablets WHERE idTab = ?", [id]);
        if (beforeRows.length === 0) return res.status(404).json({ error: "Tablet não encontrado." });
        const before = beforeRows[0];
        const sql = `
        UPDATE tablets
        SET idTomb = ?, imei = ?, idEmp = ?, rowVersion = rowVersion + 1
        WHERE idTab = ? AND rowVersion = ?
        `;
        const [result] = await db.query(sql, [idTomb, imei, idEmp, id, Number(rowVersion)]);
        if (result.affectedRows === 0) {
            return res.status(409).json({
                error: "Este tablet foi alterado por outro operador. Recarregue a página antes de salvar novamente.",
            });
        }

        await registrarLog({
            acao: "EDICAO",
            entidade: "tablet",
            entidadeId: Number(id),
            req,
            detalhes: {
                antes: { idTomb: before.idTomb, imei: before.imei, idUser: before.idUser, idEmp: before.idEmp },
                depois: { idTomb, imei, idUser: before.idUser, idEmp, rowVersion: Number(rowVersion) + 1 },
            },
        });

        res.json({ message: "Tablet atualizado com sucesso.", rowVersion: Number(rowVersion) + 1 });
    } catch (err) {
        const msg = mapDbError(err, {
            duplicateFields: {
                imei: "Este IMEI já está cadastrado em outro tablet.",
                idTomb: "Este Tombamento já está cadastrado em outro tablet.",
            },
            fallback: "Erro ao atualizar tablet.",
        });
        res.status(err?.code === "ER_DUP_ENTRY" ? 409 : 500).json({ error: msg });
    }
}

// REMANEJAR TABLET (transferir para outro usuário, ou desvincular, de forma atômica e auditada)
exports.remanejarTablet = async (req, res) => {
    const { id } = req.params;
    const { idUserDestino, motivo, rowVersion } = req.body;
    if (!String(motivo || "").trim() || String(motivo).trim().length < 5) {
        return res.status(400).json({ error: "Informe um motivo com pelo menos 5 caracteres para alterar o vínculo." });
    }
    if (!Number.isInteger(Number(rowVersion))) {
        return res.status(400).json({ error: "rowVersion é obrigatório para remanejar o tablet." });
    }
    const destino = (idUserDestino === undefined || idUserDestino === null || idUserDestino === "")
        ? null
        : idUserDestino;

    let conn;
    try {
        conn = await db.getConnection();
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
        if (Number(tablet.rowVersion) !== Number(rowVersion)) {
            await conn.rollback();
            return res.status(409).json({
                error: "O vínculo foi alterado por outro operador. Recarregue os dados antes de continuar.",
            });
        }

        const mesmoDono = (tablet.idUser === null && destino === null) || String(tablet.idUser) === String(destino);
        if (mesmoDono) {
            await conn.rollback();
            return res.status(400).json({ error: "O tablet já está com este usuário." });
        }

        let nomeUserDestino = null;
        if (destino !== null) {
            const [destRows] = await conn.query(
                `SELECT u.nomeUser, u.cpf, u.telUser, u.idUnidade, un.nomeUnidade, r.numReg
                 FROM usuarios u
                 LEFT JOIN unidades un ON un.idUnidade = u.idUnidade
                 LEFT JOIN regionais r ON r.idReg = un.idReg
                 WHERE u.idUser = ?`,
                [destino]
            );
            if (destRows.length === 0) {
                await conn.rollback();
                return res.status(400).json({ error: "Usuário de destino não encontrado." });
            }
            const usuarioDestino = destRows[0];
            nomeUserDestino = usuarioDestino.nomeUser;
            const camposFaltantes = [];
            if (!String(usuarioDestino.cpf || "").trim()) camposFaltantes.push("cpf");
            if (!String(usuarioDestino.telUser || "").trim()) camposFaltantes.push("telefone");
            if (!usuarioDestino.idUnidade) camposFaltantes.push("unidade");
            if (usuarioDestino.idUnidade && (!usuarioDestino.nomeUnidade || usuarioDestino.numReg == null)) {
                camposFaltantes.push("regional");
            }
            if (camposFaltantes.length > 0) {
                await conn.rollback();
                return res.status(422).json({
                    error: "Complete os dados do usuário de destino antes do remanejamento.",
                    code: "DESTINATION_USER_INCOMPLETE",
                    camposFaltantes,
                    usuario: {
                        idUser: Number(destino),
                        nomeUser: usuarioDestino.nomeUser,
                        cpf: usuarioDestino.cpf || "",
                        telUser: usuarioDestino.telUser || "",
                        idUnidade: usuarioDestino.idUnidade || null,
                    },
                });
            }

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

        const novaVersao = Number(tablet.rowVersion) + 1;
        const [updateResult] = await conn.query(
            "UPDATE tablets SET idUser = ?, rowVersion = rowVersion + 1 WHERE idTab = ? AND rowVersion = ?",
            [destino, id, Number(rowVersion)]
        );
        if (updateResult.affectedRows === 0) {
            await conn.rollback();
            return res.status(409).json({ error: "Conflito de concorrência ao atualizar o vínculo." });
        }

        await conn.query(
            `INSERT INTO tablet_usuario_historico
             (idTab, idTombSnapshot, idUserAnterior, nomeUserAnterior, idUserNovo, nomeUserNovo,
              idLoginResponsavel, acao, motivo, rowVersionAnterior, rowVersionNova)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id,
                tablet.idTomb,
                tablet.idUser,
                tablet.nomeUserAtual,
                destino,
                nomeUserDestino,
                req.usuario?.idLogin || null,
                destino === null ? "DESVINCULACAO" : "REMANEJAMENTO",
                String(motivo).trim(),
                Number(rowVersion),
                novaVersao,
            ]
        );
        await conn.commit();

        await registrarLog({
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
                motivo: String(motivo).trim(),
                rowVersionAnterior: Number(rowVersion),
                rowVersionNova: novaVersao,
            },
        });

        res.json({
            message: destino === null ? "Tablet desvinculado com sucesso." : "Tablet remanejado com sucesso.",
            rowVersion: novaVersao,
        });
    } catch (err) {
        if (conn) {
            try { await conn.rollback(); } catch (_) { /* noop */ }
        }
        res.status(500).json({ error: mapDbError(err, { fallback: "Erro ao remanejar tablet." }) });
    } finally {
        conn?.release();
    }
};



exports.deletarTablet = async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await db.query("SELECT * FROM tablets WHERE idTab = ?", [id]);
        if (rows.length === 0) return res.status(404).json({ error: "Tablet não encontrado." });

        await db.query("DELETE FROM tablets WHERE idTab = ?", [id]);

        await registrarLog({
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
