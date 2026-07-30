require("dotenv").config();
const jwt = require("jsonwebtoken");
const db = require("../src/config/db");
const { JWT_SECRET } = require("../src/config/authConfig");

(async () => {
    const [[admin]] = await db.query(
        "SELECT idLogin, nivel, tokenVersion FROM login WHERE nivel = 'admin' AND ativo = 1 ORDER BY idLogin LIMIT 1"
    );
    const token = jwt.sign({
        idLogin: admin.idLogin,
        nivel: admin.nivel,
        role: admin.nivel,
        tokenVersion: Number(admin.tokenVersion || 0),
    }, JWT_SECRET, { expiresIn: "2m" });
    const headers = { Authorization: `Bearer ${token}` };

    const listResponse = await fetch("http://localhost:3001/admin/contas", { headers });
    const accounts = await listResponse.json();
    const pending = accounts.find((item) => item.trocaSenhaObrigatoria);
    console.log(JSON.stringify({
        listStatus: listResponse.status,
        total: accounts.length,
        possuiIndicadorSeguro: accounts.every((item) => typeof item.senhaProvisoriaDisponivel === "boolean"),
        expoeSenhaNaLista: accounts.some((item) => "senha" in item || "provisionalPasswordEncrypted" in item),
    }));

    if (pending) {
        const passwordResponse = await fetch(
            `http://localhost:3001/admin/contas/${pending.idLogin}/senha-provisoria`,
            { headers }
        );
        console.log(JSON.stringify({
            consultaLegadaStatus: passwordResponse.status,
            credencialDisponivel: pending.senhaProvisoriaDisponivel,
        }));
    }
    await db.end();
})().catch(async (error) => {
    console.error(error.message);
    try { await db.end(); } catch {}
    process.exit(1);
});
