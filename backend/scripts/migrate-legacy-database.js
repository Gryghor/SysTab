require("dotenv").config();

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const db = require("../src/config/db");

const apply = process.argv.includes("--apply");
const requiredTables = ["tablets", "usuarios", "chamados", "login", "unidades", "regionais"];

async function rows(sql, params = []) {
    const [result] = await db.query(sql, params);
    return result;
}

async function tableExists(table) {
    return (await rows("SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?", [table])).length > 0;
}

async function columnsFor(table) {
    const result = await rows("SELECT column_name AS name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ?", [table]);
    return new Set(result.map((item) => item.name));
}

async function ensureColumn(table, name, definition) {
    if ((await columnsFor(table)).has(name)) return false;
    await db.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${name}\` ${definition}`);
    return true;
}

async function hasUniqueIndex(table, column) {
    const result = await rows("SELECT index_name FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ? AND non_unique = 0", [table, column]);
    return result.length > 0;
}

async function ensureIndex(table, name, expression) {
    const result = await rows("SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?", [table, name]);
    if (result.length > 0) return false;
    await db.query(`ALTER TABLE \`${table}\` ADD ${expression}`);
    return true;
}

async function tabletUserForeignKeys() {
    return rows(`SELECT kcu.constraint_name AS name, rc.delete_rule AS deleteRule
        FROM information_schema.key_column_usage kcu
        JOIN information_schema.referential_constraints rc
          ON rc.constraint_schema = kcu.constraint_schema AND rc.constraint_name = kcu.constraint_name
       WHERE kcu.table_schema = DATABASE() AND kcu.table_name = 'tablets'
         AND kcu.column_name = 'idUser' AND kcu.referenced_table_name = 'usuarios'`);
}

async function preflight() {
    const missing = [];
    for (const table of requiredTables) if (!(await tableExists(table))) missing.push(table);
    if (missing.length) throw new Error(`Tabelas obrigatorias ausentes: ${missing.join(", ")}`);

    const [[owners]] = await db.query("SELECT COUNT(*) AS total FROM (SELECT idUser FROM tablets WHERE idUser IS NOT NULL GROUP BY idUser HAVING COUNT(*) > 1) duplicados");
    const [[orphans]] = await db.query("SELECT COUNT(*) AS total FROM tablets t LEFT JOIN usuarios u ON u.idUser = t.idUser WHERE t.idUser IS NOT NULL AND u.idUser IS NULL");
    const [[logins]] = await db.query("SELECT COUNT(*) AS total FROM (SELECT nome FROM login GROUP BY nome HAVING COUNT(*) > 1) duplicados");
    const [[database]] = await db.query("SELECT DATABASE() AS name");
    const report = {
        database: database.name,
        duplicateTabletOwners: Number(owners.total),
        orphanTabletOwners: Number(orphans.total),
        duplicateLoginNames: Number(logins.total),
        tabletsUserForeignKeys: await tabletUserForeignKeys(),
    };
    report.ready = !report.duplicateTabletOwners && !report.orphanTabletOwners && !report.duplicateLoginNames;
    if (!report.ready) throw new Error(`Pre-validacao bloqueou a migration: ${JSON.stringify(report)}`);
    return report;
}

function dumpExecutable() {
    const candidates = [
        process.env.MYSQLDUMP_PATH,
        "C:\\xampp\\mysql\\bin\\mysqldump.exe",
        "C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysqldump.exe",
        "C:\\Program Files\\MariaDB 11.0\\bin\\mariadb-dump.exe",
        "C:\\Program Files\\MariaDB 10.11\\bin\\mariadb-dump.exe",
        "mysqldump",
    ];
    return candidates.find((candidate) => candidate && (candidate === "mysqldump" || fs.existsSync(candidate)));
}

function createBackup() {
    const directory = path.resolve(__dirname, "../backups");
    fs.mkdirSync(directory, { recursive: true });
    const file = path.join(directory, `systab-before-migration-${new Date().toISOString().replace(/[:.]/g, "-")}.sql`);
    const result = spawnSync(dumpExecutable(), ["--single-transaction", "--routines", "--events", "--default-character-set=utf8mb4", "-h", process.env.DB_HOST || "127.0.0.1", "-P", String(process.env.DB_PORT || 3306), "-u", process.env.DB_USER || "", process.env.DB_NAME || ""], {
        env: { ...process.env, MYSQL_PWD: process.env.DB_PASSWORD || "" }, encoding: "buffer", maxBuffer: 64 * 1024 * 1024,
    });
    if (result.error || result.status !== 0) throw new Error(`Backup logico nao criado: ${(result.error || {}).message || result.stderr.toString("utf8")}`);
    fs.writeFileSync(file, result.stdout);
    return file;
}

async function applyMigration() {
    const changed = [];
    const add = async (table, name, definition) => { if (await ensureColumn(table, name, definition)) changed.push(`${table}.${name}`); };
    await add("tablets", "rowVersion", "INT UNSIGNED NOT NULL DEFAULT 1");
    if (!(await hasUniqueIndex("tablets", "idUser"))) { await db.query("ALTER TABLE tablets ADD UNIQUE KEY uq_tablets_idUser (idUser)"); changed.push("tablets.idUser unique"); }

    const keys = await tabletUserForeignKeys();
    if (keys.length !== 1 || keys[0].deleteRule !== "RESTRICT") {
        for (const key of keys) await db.query(`ALTER TABLE tablets DROP FOREIGN KEY \`${key.name}\``);
        await db.query("ALTER TABLE tablets ADD CONSTRAINT fk_tablets_usuario FOREIGN KEY (idUser) REFERENCES usuarios (idUser) ON UPDATE RESTRICT ON DELETE RESTRICT");
        changed.push("tablets.idUser foreign key RESTRICT");
    }

    await db.query(`CREATE TABLE IF NOT EXISTS tablet_usuario_historico (
        idHistorico BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, idTab INT NOT NULL, idTombSnapshot INT NOT NULL,
        idUserAnterior INT NULL, nomeUserAnterior VARCHAR(100) NULL, idUserNovo INT NULL, nomeUserNovo VARCHAR(100) NULL,
        idLoginResponsavel INT NULL, acao VARCHAR(40) NOT NULL, motivo VARCHAR(500) NOT NULL,
        rowVersionAnterior INT UNSIGNED NOT NULL, rowVersionNova INT UNSIGNED NOT NULL,
        dataHora TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (idHistorico),
        KEY idx_historico_tablet_data (idTab, dataHora), KEY idx_historico_usuario_anterior (idUserAnterior),
        KEY idx_historico_usuario_novo (idUserNovo), KEY idx_historico_responsavel (idLoginResponsavel)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

    for (const [name, definition] of [
        ["idUserOriginal", "INT NULL"], ["nomeUserSnapshot", "VARCHAR(100) NULL"], ["telUserSnapshot", "VARCHAR(20) NULL"],
        ["cpfSnapshot", "VARCHAR(14) NULL"], ["idUnidadeSnapshot", "INT NULL"], ["nomeUnidadeSnapshot", "VARCHAR(120) NULL"],
        ["regionalSnapshot", "INT NULL"], ["idLoginCriador", "INT NULL"], ["nomeCriadorSnapshot", "VARCHAR(100) NULL"],
    ]) await add("chamados", name, definition);
    if (await ensureIndex("chamados", "idx_chamados_usuario_original", "KEY idx_chamados_usuario_original (idUserOriginal)")) changed.push("chamados.idUserOriginal index");

    await db.query(`CREATE TABLE IF NOT EXISTS logs (
        idLog INT NOT NULL AUTO_INCREMENT, acao VARCHAR(50) NOT NULL, entidade VARCHAR(50) NOT NULL, entidadeId INT NULL,
        idLoginResponsavel INT NULL, nomeResponsavel VARCHAR(100) NULL, detalhes TEXT NULL,
        dataHora TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (idLog),
        KEY idx_logs_entidade (entidade, entidadeId), KEY idx_logs_dataHora (dataHora), KEY idx_logs_responsavel (idLoginResponsavel)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);

    if (!(await hasUniqueIndex("login", "nome"))) { await db.query("ALTER TABLE login ADD UNIQUE KEY uq_login_nome (nome)"); changed.push("login.nome unique"); }
    await add("login", "ativo", "TINYINT(1) NOT NULL DEFAULT 1");
    await add("login", "tokenVersion", "INT UNSIGNED NOT NULL DEFAULT 0");
    await add("login", "mustChangePassword", "TINYINT(1) NOT NULL DEFAULT 0");
    await add("login", "provisionalPasswordEncrypted", "TEXT NULL");

    await db.query(`CREATE TABLE IF NOT EXISTS configuracoes (
        chave VARCHAR(100) NOT NULL, valor VARCHAR(255) NOT NULL,
        atualizadoEm TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (chave)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`);
    await db.query("INSERT INTO configuracoes (chave, valor) VALUES ('cpf_obrigatorio', '1') ON DUPLICATE KEY UPDATE chave = chave");
    await db.query("ALTER TABLE usuarios MODIFY COLUMN cpf VARCHAR(14) NULL");
    changed.push("configuracoes.cpf_obrigatorio", "usuarios.cpf nullable");
    return changed;
}

(async () => {
    try {
        const before = await preflight();
        if (!apply) { console.log(JSON.stringify({ mode: "dry-run", readyToApply: true, ...before }, null, 2)); return; }
        const backup = createBackup();
        const changed = await applyMigration();
        const verified = await preflight();
        console.log(JSON.stringify({ mode: "apply", backup, changed, verified }, null, 2));
    } catch (error) {
        console.error(error.stack || error.message);
        process.exitCode = 1;
    } finally {
        await db.end();
    }
})();
