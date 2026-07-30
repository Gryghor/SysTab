require("dotenv").config();
const db = require("../src/config/db");

(async () => {
    const [columns] = await db.query(
        "SHOW COLUMNS FROM login LIKE 'mustChangePassword'"
    );
    if (columns.length === 0) {
        await db.query(
            "ALTER TABLE login ADD COLUMN mustChangePassword TINYINT(1) NOT NULL DEFAULT 0 AFTER tokenVersion"
        );
        console.log("Migração aplicada: login.mustChangePassword");
    } else {
        console.log("Migração já aplicada: login.mustChangePassword");
    }

    const [[summary]] = await db.query(
        "SELECT COUNT(*) AS total, SUM(mustChangePassword = 1) AS pendentes FROM login"
    );
    console.log(JSON.stringify(summary));
    await db.end();
})().catch(async (error) => {
    console.error(error.message);
    try { await db.end(); } catch {}
    process.exit(1);
});
