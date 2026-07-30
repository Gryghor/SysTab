require("dotenv").config();
const db = require("../src/config/db");

(async () => {
    const [columns] = await db.query(
        "SHOW COLUMNS FROM login LIKE 'provisionalPasswordEncrypted'"
    );
    if (columns.length === 0) {
        await db.query(
            "ALTER TABLE login ADD COLUMN provisionalPasswordEncrypted TEXT NULL AFTER mustChangePassword"
        );
        console.log("Migração aplicada: login.provisionalPasswordEncrypted");
    } else {
        console.log("Migração já aplicada: login.provisionalPasswordEncrypted");
    }

    const [[summary]] = await db.query(
        "SELECT COUNT(*) AS total, SUM(provisionalPasswordEncrypted IS NOT NULL) AS armazenadas FROM login"
    );
    console.log(JSON.stringify(summary));
    await db.end();
})().catch(async (error) => {
    console.error(error.message);
    try { await db.end(); } catch {}
    process.exit(1);
});
