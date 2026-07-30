require("dotenv").config();
const jwt = require("jsonwebtoken");
const db = require("../src/config/db");
const { JWT_SECRET } = require("../src/config/authConfig");

(async () => {
    const [[account]] = await db.query(
        "SELECT idLogin, nivel, tokenVersion FROM login WHERE ativo = 1 AND mustChangePassword = 0 ORDER BY idLogin LIMIT 1"
    );
    const token = jwt.sign({
        idLogin: account.idLogin,
        nivel: account.nivel,
        role: account.nivel,
        tokenVersion: Number(account.tokenVersion || 0),
    }, JWT_SECRET, { expiresIn: "2m" });
    const headers = { Authorization: `Bearer ${token}` };

    const listResponse = await fetch("http://localhost:3001/chamados", { headers });
    const chamados = await listResponse.json();
    const first = chamados[0];
    const detailResponse = first
        ? await fetch(`http://localhost:3001/chamados/id/${first.idChamado}`, { headers })
        : null;
    const detail = detailResponse ? await detailResponse.json() : null;

    console.log(JSON.stringify({
        listStatus: listResponse.status,
        total: chamados.length,
        listPossuiCampoCriador: !first || Object.prototype.hasOwnProperty.call(first, "nomeCriadorSnapshot"),
        detailStatus: detailResponse?.status || null,
        detailPossuiCampoCriador: !detail || Object.prototype.hasOwnProperty.call(detail, "nomeCriadorSnapshot"),
    }));
    await db.end();
})().catch(async (error) => {
    console.error(error.message);
    try { await db.end(); } catch {}
    process.exit(1);
});
