require("dotenv").config();

const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const db = require("../src/config/db");
const { JWT_SECRET } = require("../src/config/authConfig");

async function getJson(path, headers = {}) {
    const response = await fetch(`http://localhost:3001${path}`, { headers });
    let body = null;
    try {
        body = await response.json();
    } catch {
        body = null;
    }
    return { path, status: response.status, body };
}

function assertOk(result) {
    assert.equal(result.status, 200, `${result.path} retornou HTTP ${result.status}`);
}

(async () => {
    const [[admin]] = await db.query(
        `SELECT idLogin, nivel, tokenVersion
           FROM login
          WHERE nivel = 'admin'
            AND ativo = 1
            AND COALESCE(mustChangePassword, 0) = 0
          ORDER BY idLogin
          LIMIT 1`
    );
    assert.ok(admin, "Nenhuma conta administrativa ativa e liberada para o smoke test.");

    const token = jwt.sign({
        idLogin: admin.idLogin,
        nivel: admin.nivel,
        role: admin.nivel,
        tokenVersion: Number(admin.tokenVersion || 0),
    }, JWT_SECRET, { expiresIn: "2m" });
    const headers = { Authorization: `Bearer ${token}` };

    const unauthorized = await getJson("/tablets");
    assert.equal(unauthorized.status, 401, "Rota protegida aceitou requisição sem token.");

    const paths = [
        "/tablets",
        "/usuarios",
        "/unidades",
        "/regionais",
        "/empresas",
        "/chamados",
        "/chamados/atrasados",
        "/logs",
        "/admin/contas",
    ];
    const results = [];
    for (const path of paths) {
        const result = await getJson(path, headers);
        assertOk(result);
        results.push({
            path,
            status: result.status,
            total: Array.isArray(result.body) ? result.body.length : null,
        });
    }

    const tablets = (await getJson("/tablets", headers)).body;
    const chamados = (await getJson("/chamados", headers)).body;
    if (Array.isArray(tablets) && tablets[0]) {
        const detail = await getJson(`/tablets/${tablets[0].idTab}`, headers);
        assertOk(detail);
        results.push({ path: `/tablets/${tablets[0].idTab}`, status: detail.status, total: 1 });
    }
    if (Array.isArray(chamados) && chamados[0]) {
        const detail = await getJson(`/chamados/id/${chamados[0].idChamado}`, headers);
        assertOk(detail);
        assert.ok(
            Object.prototype.hasOwnProperty.call(detail.body || {}, "nomeCriadorSnapshot"),
            "Detalhe do chamado não contém o snapshot de quem abriu."
        );
        results.push({ path: `/chamados/id/${chamados[0].idChamado}`, status: detail.status, total: 1 });
    }

    const [[tabletStats]] = await db.query(
        `SELECT COUNT(*) AS total,
                SUM(idUser IS NULL) AS semVinculo
           FROM tablets`
    );
    const [[duplicateStats]] = await db.query(
        `SELECT COUNT(*) AS total
           FROM (
                SELECT idUser
                  FROM tablets
                 WHERE idUser IS NOT NULL
                 GROUP BY idUser
                HAVING COUNT(*) > 1
           ) duplicados`
    );
    const [[uniqueIndex]] = await db.query(
        `SELECT COUNT(*) AS total
           FROM information_schema.statistics
          WHERE table_schema = DATABASE()
            AND table_name = 'tablets'
            AND column_name = 'idUser'
            AND non_unique = 0`
    );
    const [foreignKeys] = await db.query(
        `SELECT rc.delete_rule AS deleteRule
           FROM information_schema.key_column_usage kcu
           JOIN information_schema.referential_constraints rc
             ON rc.constraint_schema = kcu.constraint_schema
            AND rc.constraint_name = kcu.constraint_name
          WHERE kcu.table_schema = DATABASE()
            AND kcu.table_name = 'tablets'
            AND kcu.column_name = 'idUser'
            AND kcu.referenced_table_name = 'usuarios'`
    );
    const [[duplicateAccounts]] = await db.query(
        `SELECT COUNT(*) AS total
           FROM (
                SELECT nome
                  FROM login
                 GROUP BY nome
                HAVING COUNT(*) > 1
           ) duplicadas`
    );

    assert.equal(Number(duplicateStats.total), 0, "Existem usuários vinculados a mais de um tablet.");
    assert.ok(Number(uniqueIndex.total) > 0, "Não foi encontrado índice único em tablets.idUser.");
    assert.ok(
        foreignKeys.length > 0 && foreignKeys.every((item) => item.deleteRule === "RESTRICT"),
        "A chave estrangeira tablets.idUser não está integralmente em DELETE RESTRICT."
    );
    assert.equal(Number(duplicateAccounts.total), 0, "Existem nomes de acesso duplicados.");

    console.log(JSON.stringify({
        ok: true,
        autenticacaoSemToken: unauthorized.status,
        endpoints: results,
        banco: {
            tablets: Number(tabletStats.total),
            tabletsSemVinculo: Number(tabletStats.semVinculo),
            vinculosDuplicados: Number(duplicateStats.total),
            indiceUnicoIdUser: Number(uniqueIndex.total) > 0,
            regrasDeleteIdUser: foreignKeys.map((item) => item.deleteRule),
            nomesDeAcessoDuplicados: Number(duplicateAccounts.total),
        },
    }, null, 2));
    await db.end();
})().catch(async (error) => {
    console.error(error.stack || error.message);
    try { await db.end(); } catch {}
    process.exit(1);
});
