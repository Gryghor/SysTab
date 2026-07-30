jest.mock("../src/config/db", () => ({ query: jest.fn() }));
jest.mock("../src/utils/logger", () => ({ registrarLog: jest.fn().mockResolvedValue(undefined) }));
const mockOsRender = jest.fn();
const mockOsGenerate = jest.fn(() => Buffer.from("docx"));
jest.mock("pizzip", () => jest.fn(() => ({})));
jest.mock("docxtemplater", () => jest.fn(() => ({
  render: mockOsRender,
  getZip: () => ({ generate: mockOsGenerate }),
})));

const fs = require("fs");
const db = require("../src/config/db");
const { registrarLog } = require("../src/utils/logger");
const chamados = require("../src/controllers/chamadosController");
const { createResponse, createRequest } = require("./testUtils");

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

test("criarChamado grava entrada e auditoria", async () => {
  db.query.mockResolvedValueOnce([{ insertId: 10, affectedRows: 1 }]);
  const req = createRequest({ body: { idTab: 421, descricao: "Tela quebrada", item: "Nenhum" } });
  const res = createResponse();
  await chamados.criarChamado(req, res);
  expect(db.query).toHaveBeenCalledWith(expect.stringContaining("nomeCriadorSnapshot"), ["Tela quebrada", "Nenhum", 1, 421]);
  expect(db.query.mock.calls[0][0]).toContain("LEFT JOIN login criador");
  expect(registrarLog).toHaveBeenCalledWith(expect.objectContaining({ entidade: "chamado", entidadeId: 10 }));
  expect(res.statusCode).toBe(201);
});

test("listarChamados retorna consulta agregada", async () => {
  db.query.mockResolvedValueOnce([[{ idChamado: 10, nomeUser: "Maria" }]]);
  const res = createResponse();
  await chamados.listarChamados(createRequest(), res);
  expect(res.body[0].idChamado).toBe(10);
  expect(db.query.mock.calls[0][0]).toContain("COALESCE(c.nomeUserSnapshot, usuarioAtual.nomeUser)");
});

test("listarChamados prioriza o snapshot do usuário original", async () => {
  db.query.mockResolvedValueOnce([[]]);
  await chamados.listarChamados(createRequest(), createResponse());
  const sql = db.query.mock.calls[0][0];
  expect(sql).toContain("COALESCE(c.nomeUserSnapshot");
  expect(sql).not.toContain("usuarios ON tablets.idUser = usuarios.idUser");
});

test("buscarChamadoPorIdChamado retorna item e 404", async () => {
  db.query.mockResolvedValueOnce([[{ idChamado: 10 }]]).mockResolvedValueOnce([[]]);
  const ok = createResponse();
  await chamados.buscarChamadoPorIdChamado(createRequest({ params: { id: "10" } }), ok);
  expect(ok.body.idChamado).toBe(10);
  const missing = createResponse();
  await chamados.buscarChamadoPorIdChamado(createRequest({ params: { id: "99" } }), missing);
  expect(missing.statusCode).toBe(404);
});

test("listarChamadosAtrasados aplica sete dias por padrão", async () => {
  db.query.mockResolvedValueOnce([[{ idChamado: 10 }]]);
  const res = createResponse();
  await chamados.listarChamadosAtrasados(createRequest(), res);
  expect(db.query).toHaveBeenCalledWith(expect.stringContaining("INTERVAL ? DAY"), [7]);
  expect(res.body).toHaveLength(1);
});

test("listarPorTablet filtra pelo idTab", async () => {
  db.query.mockResolvedValueOnce([[{ idChamado: 10 }]]);
  const res = createResponse();
  await chamados.listarPorTablet(createRequest({ params: { id: "421" } }), res);
  expect(db.query).toHaveBeenCalledWith(expect.stringContaining("WHERE idTab = ?"), ["421"]);
});

test("deletarChamado rejeita inexistente e exclui existente", async () => {
  db.query.mockResolvedValueOnce([[]]);
  const missing = createResponse();
  await chamados.deletarChamado(createRequest({ params: { id: "99" } }), missing);
  expect(missing.statusCode).toBe(404);

  db.query.mockResolvedValueOnce([[{ idChamado: 10 }]]).mockResolvedValueOnce([{ affectedRows: 1 }]);
  const ok = createResponse();
  await chamados.deletarChamado(createRequest({ params: { id: "10" } }), ok);
  expect(db.query).toHaveBeenLastCalledWith("DELETE FROM chamados WHERE idChamado = ?", ["10"]);
  expect(registrarLog).toHaveBeenCalledWith(expect.objectContaining({ acao: "EXCLUSAO" }));
});

test("atualizarChamado aceita somente campos permitidos", async () => {
  db.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
  const req = createRequest({ params: { id: "10" }, body: { status: "Fechado", itensRecebidos: "Nenhum", invasor: "DROP" } });
  const res = createResponse();
  await chamados.atualizarChamado(req, res);
  const [sql, params] = db.query.mock.calls[0];
  expect(sql).toContain("status = ?");
  expect(sql).toContain("item = ?");
  expect(sql).not.toContain("invasor");
  expect(params).toEqual(["Fechado", "Nenhum", "10"]);
});

test("atualizarChamado rejeita body sem campos válidos", async () => {
  const res = createResponse();
  await chamados.atualizarChamado(createRequest({ params: { id: "10" }, body: { invasor: "x" } }), res);
  expect(res.statusCode).toBe(400);
  expect(db.query).not.toHaveBeenCalled();
});

test("fecharChamado fecha e registra auditoria", async () => {
  db.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
  const res = createResponse();
  await chamados.fecharChamado(createRequest({ params: { id: "10" } }), res);
  expect(db.query.mock.calls[0][0]).toContain("dataSaida = NOW()");
  expect(registrarLog).toHaveBeenCalledWith(expect.objectContaining({ acao: "FECHAMENTO" }));
});

test("reabrirChamado limpa data de saída", async () => {
  db.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
  const res = createResponse();
  await chamados.reabrirChamado(createRequest({ params: { id: "10" } }), res);
  expect(db.query.mock.calls[0][0]).toContain("dataSaida = NULL");
  expect(registrarLog).toHaveBeenCalledWith(expect.objectContaining({ acao: "REABERTURA" }));
});

test("gerarOS informa modelo inexistente sem consultar banco", async () => {
  jest.spyOn(fs, "existsSync").mockReturnValue(false);
  const res = createResponse();
  await chamados.gerarOS(createRequest({ params: { id: "10", tipo: "samsung" } }), res);
  expect(res.statusCode).toBe(400);
  expect(db.query).not.toHaveBeenCalled();
});

test("gerarOS renderiza e baixa documento com os dados do chamado", async () => {
  jest.spyOn(fs, "existsSync").mockReturnValue(true);
  jest.spyOn(fs, "readFileSync").mockReturnValue("modelo");
  jest.spyOn(fs, "writeFileSync").mockImplementation(() => {});
  db.query.mockResolvedValueOnce([[
    {
      idChamado: 10, descricao: "Tela", dataEntrada: new Date("2026-01-01T12:00:00Z"), item: "Nenhum",
      idTomb: 203290, imei: "355637052002110", nomeUser: "Maria", telUser: "81", cpf: "123",
      nomeUnidade: "USF", nomeRegional: 2, nomeEmp: "Empresa", idEmp: 1,
    },
  ]]);
  const res = createResponse();
  await chamados.gerarOS(createRequest({ params: { id: "10", tipo: "samsung" } }), res);
  expect(mockOsRender).toHaveBeenCalledWith(expect.objectContaining({ idChamado: 10, nomeUser: "Maria", tombamento: 203290 }));
  expect(fs.writeFileSync).toHaveBeenCalledWith(expect.stringMatching(/OS_SAMSUNG_.*\.docx$/), expect.any(Buffer));
  expect(res.download).toHaveBeenCalled();
});
