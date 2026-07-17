const db = require("../config/db");

// Registra uma entrada de auditoria. Nunca lança erro para o chamador: uma falha ao
// gravar o log não pode derrubar a operação principal (criar/editar/excluir etc).
async function registrarLog({ acao, entidade, entidadeId = null, req = null, idLoginResponsavel = null, detalhes = null }) {
    const responsavelId = req?.usuario?.idLogin ?? idLoginResponsavel ?? null;
    let nomeResponsavel = null;

    if (responsavelId) {
        try {
            const [rows] = await db.query("SELECT nome FROM login WHERE idLogin = ?", [responsavelId]);
            nomeResponsavel = rows[0]?.nome || null;
        } catch (_) {
            // segue sem nome do responsável
        }
    }

    const detalhesStr = detalhes == null
        ? null
        : (typeof detalhes === "string" ? detalhes : JSON.stringify(detalhes));

    try {
        await db.query(
            "INSERT INTO logs (acao, entidade, entidadeId, idLoginResponsavel, nomeResponsavel, detalhes) VALUES (?, ?, ?, ?, ?, ?)",
            [acao, entidade, entidadeId, responsavelId, nomeResponsavel, detalhesStr]
        );
    } catch (err) {
        console.error("Erro ao registrar log de auditoria:", err.message);
    }
}

module.exports = { registrarLog };
