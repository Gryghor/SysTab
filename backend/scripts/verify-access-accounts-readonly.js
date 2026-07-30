require("dotenv").config();
const jwt = require("jsonwebtoken");
const db = require("../src/config/db");
const { JWT_SECRET } = require("../src/config/authConfig");

(async () => {
    const [[admin]] = await db.query(
        "SELECT idLogin, nivel, tokenVersion FROM login WHERE nivel = 'admin' AND ativo = 1 ORDER BY idLogin LIMIT 1"
    );
    if (!admin) throw new Error("Nenhuma conta administrativa ativa para a verificação.");

    const token = jwt.sign({
        idLogin: admin.idLogin,
        nivel: admin.nivel,
        role: admin.nivel,
        tokenVersion: Number(admin.tokenVersion || 0),
        trocaSenhaObrigatoria: false,
    }, JWT_SECRET, { expiresIn: "2m" });

    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    const list = await fetch("http://localhost:3001/admin/contas", { headers });
    const accounts = await list.json();
    console.log(JSON.stringify({
        endpoint: "GET /admin/contas",
        status: list.status,
        total: Array.isArray(accounts) ? accounts.length : null,
        expoeSenha: Array.isArray(accounts) && accounts.some((item) => "senha" in item),
    }));

    const invalidCreate = await fetch("http://localhost:3001/admin/contas", {
        method: "POST",
        headers,
        body: JSON.stringify({ nome: "x", nivel: "padrao" }),
    });
    console.log(JSON.stringify({
        endpoint: "POST /admin/contas (inválido, sem escrita)",
        status: invalidCreate.status,
    }));

    const noPendingChange = await fetch("http://localhost:3001/auth/primeiro-acesso/senha", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ novaSenha: "SenhaQueNaoSeraAplicada123!" }),
    });
    console.log(JSON.stringify({
        endpoint: "PATCH /auth/primeiro-acesso/senha (conta sem pendência)",
        status: noPendingChange.status,
    }));

    await db.end();
})().catch(async (error) => {
    console.error(error.message);
    try { await db.end(); } catch {}
    process.exit(1);
});
