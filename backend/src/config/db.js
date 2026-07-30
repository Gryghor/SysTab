const mysql = require("mysql2");
require("dotenv").config();

const numeroDoAmbiente = (chave, padrao, minimo, maximo) => {
    const valor = Number(process.env[chave]);
    if (!Number.isFinite(valor) || valor < minimo || valor > maximo) return padrao;
    return valor;
};

const hostConfigurado = String(process.env.DB_HOST || "127.0.0.1").trim();
// No Windows, evita uma resolucao alternada entre ::1 e 127.0.0.1 para uma instalacao local.
const host = hostConfigurado.toLowerCase() === "localhost" ? "127.0.0.1" : hostConfigurado;
const connectionLimit = numeroDoAmbiente("DB_CONNECTION_LIMIT", 10, 1, 100);
const connectTimeout = numeroDoAmbiente("DB_CONNECT_TIMEOUT", 10000, 1000, 60000);
const retryDelay = numeroDoAmbiente("DB_CONNECT_RETRY_DELAY", 500, 100, 10000);

const pool = mysql.createPool({
    port: numeroDoAmbiente("DB_PORT", 3306, 1, 65535),
    host,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    charset: "utf8mb4",
    waitForConnections: true,
    connectionLimit,
    maxIdle: connectionLimit,
    idleTimeout: 60000,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    connectTimeout,
});

const promisePool = pool.promise();
const codigosDeConexaoRecuperaveis = new Set([
    "ETIMEDOUT",
    "ECONNREFUSED",
    "EHOSTUNREACH",
    "ENETUNREACH",
]);

const erroDeConexaoRecuperavel = (erro) =>
    erro?.syscall === "connect" && codigosDeConexaoRecuperaveis.has(erro?.code);

const aguardar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// O retry acontece somente antes de a conexao ser aberta. Assim, uma escrita que
// ja chegou ao MariaDB nunca e repetida por este adaptador.
const executarComUmaNovaTentativa = async (operacao) => {
    try {
        return await operacao();
    } catch (erro) {
        if (!erroDeConexaoRecuperavel(erro)) throw erro;

        console.warn(
            `Conexao com o banco falhou (${erro.code}); tentando novamente em ${retryDelay} ms.`,
        );
        await aguardar(retryDelay);
        return operacao();
    }
};

const verificarConexaoInicial = (tentativa = 1) => {
    pool.getConnection((erro, connection) => {
        if (!erro) {
            console.log("Conectado ao banco de dados MySQL!");
            connection.release();
            return;
        }

        console.error(
            `Banco de dados indisponivel na inicializacao (tentativa ${tentativa}/3): ${erro.code || erro.message}`,
        );
        if (tentativa < 3 && erroDeConexaoRecuperavel(erro)) {
            const temporizador = setTimeout(() => verificarConexaoInicial(tentativa + 1), retryDelay * tentativa);
            temporizador.unref?.();
        }
    });
};

pool.on("error", (erro) => {
    console.error(`Erro no pool MySQL: ${erro.code || erro.message}`);
});

verificarConexaoInicial();

module.exports = {
    query: (...args) => executarComUmaNovaTentativa(() => promisePool.query(...args)),
    execute: (...args) => executarComUmaNovaTentativa(() => promisePool.execute(...args)),
    getConnection: () => executarComUmaNovaTentativa(() => promisePool.getConnection()),
    end: () => promisePool.end(),
};
