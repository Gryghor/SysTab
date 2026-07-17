const db = require("../config/db");

// Lista logs de auditoria com filtros e paginação. Uso: página de admin.
exports.listarLogs = async (req, res) => {
    const { entidade, acao, entidadeId, busca, dataInicio, dataFim } = req.query;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 200);
    const offset = (page - 1) * limit;

    const where = [];
    const params = [];

    if (entidade) { where.push("entidade = ?"); params.push(entidade); }
    if (acao) { where.push("acao = ?"); params.push(acao); }
    if (entidadeId) { where.push("entidadeId = ?"); params.push(entidadeId); }
    if (dataInicio) { where.push("dataHora >= ?"); params.push(dataInicio); }
    if (dataFim) { where.push("dataHora <= ?"); params.push(dataFim); }
    if (busca) {
        where.push("(detalhes LIKE ? OR nomeResponsavel LIKE ?)");
        params.push(`%${busca}%`, `%${busca}%`);
    }

    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    try {
        const [rows] = await db.query(
            `SELECT * FROM logs ${whereClause} ORDER BY dataHora DESC, idLog DESC LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );
        const [countRows] = await db.query(`SELECT COUNT(*) AS total FROM logs ${whereClause}`, params);
        res.json({ logs: rows, total: countRows[0].total, page, limit });
    } catch (err) {
        console.error("Erro ao listar logs:", err);
        res.status(500).json({ error: "Erro ao listar logs." });
    }
};
