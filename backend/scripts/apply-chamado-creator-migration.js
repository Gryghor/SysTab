require("dotenv").config();
const db = require("../src/config/db");

(async () => {
    const [idColumns] = await db.query(
        "SHOW COLUMNS FROM chamados LIKE 'idLoginCriador'"
    );
    const [nameColumns] = await db.query(
        "SHOW COLUMNS FROM chamados LIKE 'nomeCriadorSnapshot'"
    );
    if (idColumns.length === 0) {
        await db.query(
            "ALTER TABLE chamados ADD COLUMN idLoginCriador INT NULL AFTER regionalSnapshot"
        );
    }
    if (nameColumns.length === 0) {
        await db.query(
            "ALTER TABLE chamados ADD COLUMN nomeCriadorSnapshot VARCHAR(100) NULL AFTER idLoginCriador"
        );
    }
    const [[summary]] = await db.query(
        "SELECT COUNT(*) AS total, SUM(nomeCriadorSnapshot IS NOT NULL) AS comCriador FROM chamados"
    );
    console.log(JSON.stringify({ migration: "ok", ...summary }));
    await db.end();
})().catch(async (error) => {
    console.error(error.message);
    try { await db.end(); } catch {}
    process.exit(1);
});
