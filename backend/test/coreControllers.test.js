jest.mock("../src/config/db", () => ({ query: jest.fn() }));
jest.mock("bcrypt", () => ({ compare: jest.fn() }));
jest.mock("jsonwebtoken", () => ({ sign: jest.fn(() => "token-assinado") }));

const db = require("../src/config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const auth = require("../src/controllers/authController");
const empresas = require("../src/controllers/empresasController");
const regionais = require("../src/controllers/regionaisController");
const unidades = require("../src/controllers/unidadesController");
const logs = require("../src/controllers/logsController");
const { createResponse, createRequest } = require("./testUtils");

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe("authController", () => {
  test("login rejeita usuário inexistente", async () => {
    db.query.mockResolvedValueOnce([[]]);
    const res = createResponse();
    await auth.login(createRequest({ body: { nome: "x", senha: "y" } }), res);
    expect(res.statusCode).toBe(401);
    expect(bcrypt.compare).not.toHaveBeenCalled();
  });

  test("login rejeita senha inválida", async () => {
    db.query.mockResolvedValueOnce([[{ idLogin: 2, nome: "padrao", senha: "hash", nivel: "padrao" }]]);
    bcrypt.compare.mockResolvedValueOnce(false);
    const res = createResponse();
    await auth.login(createRequest({ body: { nome: "padrao", senha: "errada" } }), res);
    expect(res.statusCode).toBe(401);
  });

  test("login assina token com id e nível corretos", async () => {
    db.query.mockResolvedValueOnce([[{ idLogin: 1, nome: "admin", senha: "hash", nivel: "admin" }]]);
    bcrypt.compare.mockResolvedValueOnce(true);
    const res = createResponse();
    await auth.login(createRequest({ body: { nome: "admin", senha: "ok" } }), res);
    expect(jwt.sign).toHaveBeenCalledWith(
      { idLogin: 1, nivel: "admin", role: "admin" },
      expect.any(String),
      { expiresIn: "1d" },
    );
    expect(res.body.usuario).toEqual({ nome: "admin", nivel: "admin", role: "admin" });
  });

  test("login devolve 500 quando o banco falha", async () => {
    db.query.mockRejectedValueOnce(new Error("db"));
    const res = createResponse();
    await auth.login(createRequest({ body: { nome: "x", senha: "y" } }), res);
    expect(res.statusCode).toBe(500);
  });
});

describe("empresasController", () => {
  test("criação valida nome obrigatório", async () => {
    const res = createResponse();
    await empresas.criarEmpresa(createRequest(), res);
    expect(res.statusCode).toBe(400);
    expect(db.query).not.toHaveBeenCalled();
  });

  test("cria e lista empresas", async () => {
    db.query.mockResolvedValueOnce([{ insertId: 7 }]).mockResolvedValueOnce([[{ idEmp: 7, nomeEmp: "X" }]]);
    const createRes = createResponse();
    await empresas.criarEmpresa(createRequest({ body: { nome: "X" } }), createRes);
    expect(createRes.statusCode).toBe(201);
    expect(createRes.body.idEmpresa).toBe(7);
    const listRes = createResponse();
    await empresas.listarEmpresas(createRequest(), listRes);
    expect(listRes.body).toEqual([{ idEmp: 7, nomeEmp: "X" }]);
  });

  test("exclusão usa a chave real idEmp", async () => {
    db.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
    await empresas.deletarEmpresa(createRequest({ params: { id: "7" } }), createResponse());
    expect(db.query).toHaveBeenCalledWith(expect.stringMatching(/WHERE idEmp = \?/), ["7"]);
  });
});

describe("regionaisController", () => {
  test("cria e lista regionais", async () => {
    db.query.mockResolvedValueOnce([{ insertId: 2 }]).mockResolvedValueOnce([[{ idReg: 2, numReg: 2 }]]);
    const createRes = createResponse();
    await regionais.criarRegional(createRequest({ body: { numReg: 2 } }), createRes);
    expect(createRes.statusCode).toBe(201);
    const listRes = createResponse();
    await regionais.listarRegionais(createRequest(), listRes);
    expect(listRes.body[0].numReg).toBe(2);
  });

  test("edição usa numReg e idReg, que são as colunas reais", async () => {
    db.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
    await regionais.editarRegional(createRequest({ params: { id: "2" }, body: { numReg: 3 } }), createResponse());
    expect(db.query).toHaveBeenCalledWith(expect.stringMatching(/SET numReg = \? WHERE idReg = \?/), [3, "2"]);
  });

  test("exclusão usa a chave real idReg", async () => {
    db.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
    await regionais.deletarRegional(createRequest({ params: { id: "2" } }), createResponse());
    expect(db.query).toHaveBeenCalledWith(expect.stringMatching(/WHERE idReg = \?/), ["2"]);
  });
});

describe("unidadesController", () => {
  test("cria e lista unidades com agregação de tablets", async () => {
    db.query.mockResolvedValueOnce([{ insertId: 9 }]).mockResolvedValueOnce([[{ idUnidade: 9, tabletsCount: 2 }]]);
    const createRes = createResponse();
    await unidades.criarUnidade(createRequest({ body: { nomeUnidade: "USF", idReg: 1 } }), createRes);
    expect(createRes.statusCode).toBe(201);
    const listRes = createResponse();
    await unidades.listarUnidades(createRequest(), listRes);
    expect(listRes.body[0].tabletsCount).toBe(2);
    expect(db.query.mock.calls[1][0]).toContain("LEFT JOIN tablets t ON t.idUser = u.idUser");
  });

  test("edição e exclusão bloqueiam perfil padrão", async () => {
    const req = createRequest({ usuario: { idLogin: 2, nivel: "padrao" }, params: { id: "9" }, body: { nome: "X", idRegional: 1 } });
    const editRes = createResponse();
    await unidades.editarUnidade(req, editRes);
    expect(editRes.statusCode).toBe(403);
    const deleteRes = createResponse();
    await unidades.deletarUnidade(req, deleteRes);
    expect(deleteRes.statusCode).toBe(403);
    expect(db.query).not.toHaveBeenCalled();
  });

  test("edição administrativa usa nomeUnidade e idReg", async () => {
    db.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
    await unidades.editarUnidade(createRequest({ params: { id: "9" }, body: { nomeUnidade: "USF", idReg: 1 } }), createResponse());
    expect(db.query).toHaveBeenCalledWith(expect.stringMatching(/SET nomeUnidade = \?, idReg = \?/), ["USF", 1, "9"]);
  });

  test("admin pode excluir unidade pela chave correta", async () => {
    db.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
    const res = createResponse();
    await unidades.deletarUnidade(createRequest({ params: { id: "9" } }), res);
    expect(db.query).toHaveBeenCalledWith("DELETE FROM unidades WHERE idUnidade = ?", ["9"]);
    expect(res.statusCode).toBe(200);
  });
});

describe("logsController", () => {
  test("monta filtros, paginação e limite máximo", async () => {
    db.query.mockResolvedValueOnce([[{ idLog: 1 }]]).mockResolvedValueOnce([[{ total: 1 }]]);
    const req = createRequest({ query: { entidade: "tablet", acao: "EDICAO", busca: "Maria", page: "2", limit: "999" } });
    const res = createResponse();
    await logs.listarLogs(req, res);
    expect(res.body).toEqual({ logs: [{ idLog: 1 }], total: 1, page: 2, limit: 200 });
    expect(db.query.mock.calls[0][1]).toEqual(["tablet", "EDICAO", "%Maria%", "%Maria%", 200, 200]);
  });

  test("devolve 500 em falha de consulta", async () => {
    db.query.mockRejectedValueOnce(new Error("db"));
    const res = createResponse();
    await logs.listarLogs(createRequest(), res);
    expect(res.statusCode).toBe(500);
  });
});
