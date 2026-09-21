const app = require('./index');

const PORT = Number(process.env.PORT || 3001);
const HOST = process.env.HOST || "0.0.0.0";

const server = app.listen(PORT, HOST, () => {
  console.log(`Servidor rodando em http://${HOST}:${PORT}`);
});

server.on("error", (error) => {
  console.error("Erro ao iniciar o servidor HTTP:", error.code || error.message);
  process.exit(1);
});
