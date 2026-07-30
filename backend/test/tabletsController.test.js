jest.mock("../src/config/db", () => ({ query: jest.fn(), getConnection: jest.fn() }));
jest.mock("../src/utils/logger", () => ({ registrarLog: jest.fn().mockResolvedValue(undefined) }));
const mockTermoRender = jest.fn();
const mockTermoGenerate = jest.fn(() => Buffer.from("docx"));
jest.mock("pizzip", () => jest.fn(() => ({})));
jest.mock("docxtemplater", () => jest.fn(() => ({
  render: mockTermoRender,
  getZip: () => ({ generate: mockTermoGenerate }),
})));

const fs = require("fs");
const db = require("../src/config/db");
const { registrarLog } = require("../src/utils/logger");
const tablets = require("../src/controllers/tabletsController");
const { createResponse, createRequest } = require("./testUtils");

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

function tabletAtual(overrides = {}) {
  return { idTab: 421, idTomb: 203290, imei: "355637052002110", idUser: 575, idEmp: 1, rowVersion: 1, ...overrides };
}

function mockConnection() {
  const conn = {
    beginTransaction: jest.fn().mockResolvedValue(undefined),
    query: jest.fn(),
    commit: jest.fn().mockResolvedValue(undefined),
    rollback: jest.fn().mockResolvedValue(undefined),
    release: jest.fn(),
  };
  db.getConnection.mockResolvedValue(conn);
  return conn;
}

describe("consulta e geração de termo", () => {
  test("gerarTermoResponsabilidade informa modelo ausente sem consultar banco", async () => {
    jest.spyOn(fs, "existsSync").mockReturnValue(false);
    const res = createResponse();
    await tablets.gerarTermoResponsabilidade(createRequest({ params: { id: "421" } }), res);
    expect(res.statusCode).toBe(400);
    expect(db.query).not.toHaveBeenCalled();
  });

  test("gerarTermoResponsabilidade renderiza e baixa DOCX do usuário vinculado", async () => {
    jest.spyOn(fs, "existsSync").mockReturnValue(true);
    jest.spyOn(fs, "readFileSync").mockReturnValue("modelo");
    jest.spyOn(fs, "writeFileSync").mockImplementation(() => {});
    db.query.mockResolvedValueOnce([[
      { idTomb: 203290, imei: "355637052002110", nomeUser: "Maria", cpf: "123", nomeUnidade: "USF", regional: 2 },
    ]]);
    const res = createResponse();
    await tablets.gerarTermoResponsabilidade(createRequest({ params: { id: "421" } }), res);
    expect(mockTermoRender).toHaveBeenCalledWith(expect.objectContaining({ tombamento: 203290, nomeUser: "Maria", unidade: "USF" }));
    expect(fs.writeFileSync).toHaveBeenCalledWith(expect.stringMatching(/TERMO_RESPONSABILIDADE_203290_\d+\.docx$/), expect.any(Buffer));
    expect(res.download).toHaveBeenCalledWith(expect.stringMatching(/TERMO_RESPONSABILIDADE_203290_\d+\.docx$/));
  });

  test("listarTablets aplica filtro de unidade", async () => {
    db.query.mockResolvedValueOnce([[tabletAtual()]]);
    const res = createResponse();
    await tablets.listarTablets(createRequest({ query: { unidade: "2" } }), res);
    expect(db.query.mock.calls[0][0]).toContain("WHERE u.idUnidade = ?");
    expect(db.query.mock.calls[0][1]).toEqual(["2"]);
    expect(res.body).toHaveLength(1);
  });

  test("buscarTablet exige tombamento ou IMEI e retorna resultados", async () => {
    const invalid = createResponse();
    await tablets.buscarTablet(createRequest(), invalid);
    expect(invalid.statusCode).toBe(400);
    db.query.mockResolvedValueOnce([[tabletAtual()]]);
    const ok = createResponse();
    await tablets.buscarTablet(createRequest({ query: { tombamento: "203290" } }), ok);
    expect(ok.body[0].idTab).toBe(421);
  });

  test("buscarTabletPorId devolve registro ou 404", async () => {
    db.query.mockResolvedValueOnce([[tabletAtual()]]).mockResolvedValueOnce([[]]);
    const ok = createResponse();
    await tablets.buscarTabletPorId(createRequest({ params: { id: "421" } }), ok);
    expect(ok.body.idUser).toBe(575);
    const missing = createResponse();
    await tablets.buscarTabletPorId(createRequest({ params: { id: "999" } }), missing);
    expect(missing.statusCode).toBe(404);
  });
});

describe("criarTablet", () => {
  test("valida campos obrigatórios", async () => {
    const res = createResponse();
    await tablets.criarTablet(createRequest({ body: { idTomb: 1 } }), res);
    expect(res.statusCode).toBe(400);
  });

  test("cria vínculo disponível e registra auditoria", async () => {
    const conn = mockConnection();
    conn.query
      .mockResolvedValueOnce([[{ nomeUser: "Maria" }]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ insertId: 421 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    const req = createRequest({ body: { idTomb: 203290, imei: "355637052002110", idUser: 575, idEmp: 1 } });
    const res = createResponse();
    await tablets.criarTablet(req, res);
    expect(conn.query.mock.calls[2]).toEqual([expect.stringContaining("INSERT INTO tablets"), [203290, "355637052002110", 575, 1]]);
    expect(conn.query.mock.calls[3][0]).toContain("tablet_usuario_historico");
    expect(conn.commit).toHaveBeenCalled();
    expect(registrarLog).toHaveBeenCalledWith(expect.objectContaining({ entidade: "tablet", entidadeId: 421 }));
    expect(res.statusCode).toBe(201);
  });

  test("rejeita usuário que já possui tablet", async () => {
    const conn = mockConnection();
    conn.query.mockResolvedValueOnce([[{ nomeUser: "Maria" }]]).mockResolvedValueOnce([[{ idTab: 1, idTomb: 200001 }]]);
    const res = createResponse();
    await tablets.criarTablet(createRequest({ body: { idTomb: 203290, imei: "355637052002110", idUser: 575, idEmp: 1 } }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain("já possui");
    expect(conn.rollback).toHaveBeenCalled();
  });
});

describe("editarTablet", () => {
  test("edita metadados sem tocar no vínculo do usuário", async () => {
    db.query
      .mockResolvedValueOnce([[tabletAtual()]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    const req = createRequest({ params: { id: "421" }, body: { idTomb: 203290, imei: "999999999999999", idEmp: 1, rowVersion: 1 } });
    const res = createResponse();
    await tablets.editarTablet(req, res);
    expect(db.query.mock.calls[1][0]).not.toContain("idUser");
    expect(db.query.mock.calls[1][1]).toEqual([203290, "999999999999999", 1, "421", 1]);
    expect(res.body.rowVersion).toBe(2);
    expect(res.statusCode).toBe(200);
  });

  test("rejeita tentativa de alterar idUser pela edição comum", async () => {
    const req = createRequest({ params: { id: "421" }, body: { idTomb: 203290, imei: "999999999999999", idEmp: 1, idUser: null, rowVersion: 1 } });
    const res = createResponse();
    await tablets.editarTablet(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain("Remanejar");
    expect(db.query).not.toHaveBeenCalled();
  });

  test("edição com versão antiga devolve conflito", async () => {
    db.query
      .mockResolvedValueOnce([[tabletAtual({ rowVersion: 2 })]])
      .mockResolvedValueOnce([{ affectedRows: 0 }]);
    const req = createRequest({ params: { id: "421" }, body: { idTomb: 203290, imei: "999999999999999", idEmp: 1, rowVersion: 1 } });
    const res = createResponse();
    await tablets.editarTablet(req, res);
    expect(res.statusCode).toBe(409);
    expect(registrarLog).not.toHaveBeenCalled();
  });
});

describe("remanejarTablet", () => {
  test("remaneja em transação, trava tablet e registra dono anterior/novo", async () => {
    const conn = mockConnection();
    conn.query
      .mockResolvedValueOnce([[tabletAtual({ nomeUserAtual: "Maria" })]])
      .mockResolvedValueOnce([[{ nomeUser: "João", cpf: "12345678901", telUser: "81999999999", idUnidade: 2, nomeUnidade: "USF Centro", numReg: 1 }]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    const req = createRequest({ params: { id: "421" }, body: { idUserDestino: 600, motivo: "troca documentada", rowVersion: 1 } });
    const res = createResponse();
    await tablets.remanejarTablet(req, res);
    expect(conn.query.mock.calls[0][0]).toContain("FOR UPDATE");
    expect(conn.query.mock.calls[3]).toEqual([
      "UPDATE tablets SET idUser = ?, rowVersion = rowVersion + 1 WHERE idTab = ? AND rowVersion = ?",
      [600, "421", 1],
    ]);
    expect(conn.query.mock.calls[4][0]).toContain("tablet_usuario_historico");
    expect(conn.commit).toHaveBeenCalled();
    expect(conn.release).toHaveBeenCalled();
    expect(registrarLog).toHaveBeenCalledWith(expect.objectContaining({ acao: "REMANEJAMENTO" }));
  });

  test("bloqueia destino com cadastro incompleto antes de remanejar", async () => {
    const conn = mockConnection();
    conn.query
      .mockResolvedValueOnce([[tabletAtual({ nomeUserAtual: "Maria" })]])
      .mockResolvedValueOnce([[{ nomeUser: "João", cpf: "", telUser: "", idUnidade: null, nomeUnidade: null, numReg: null }]]);
    const res = createResponse();
    await tablets.remanejarTablet(createRequest({ params: { id: "421" }, body: { idUserDestino: 600, motivo: "troca documentada", rowVersion: 1 } }), res);
    expect(res.statusCode).toBe(422);
    expect(res.body.code).toBe("DESTINATION_USER_INCOMPLETE");
    expect(res.body.camposFaltantes).toEqual(["cpf", "telefone", "unidade"]);
    expect(conn.rollback).toHaveBeenCalled();
    expect(conn.commit).not.toHaveBeenCalled();
  });
  test("rejeita destino ocupado e faz rollback", async () => {
    const conn = mockConnection();
    conn.query
      .mockResolvedValueOnce([[tabletAtual({ nomeUserAtual: "Maria" })]])
      .mockResolvedValueOnce([[{ nomeUser: "João", cpf: "12345678901", telUser: "81999999999", idUnidade: 2, nomeUnidade: "USF Centro", numReg: 1 }]])
      .mockResolvedValueOnce([[{ idTab: 2, idTomb: 200002 }]]);
    const res = createResponse();
    await tablets.remanejarTablet(createRequest({ params: { id: "421" }, body: { idUserDestino: 600, motivo: "troca documentada", rowVersion: 1 } }), res);
    expect(res.statusCode).toBe(400);
    expect(conn.rollback).toHaveBeenCalled();
    expect(conn.commit).not.toHaveBeenCalled();
  });
});

describe("deletarTablet", () => {
  test("devolve 404 sem registro", async () => {
    db.query.mockResolvedValueOnce([[]]);
    const res = createResponse();
    await tablets.deletarTablet(createRequest({ params: { id: "999" } }), res);
    expect(res.statusCode).toBe(404);
  });

  test("exclui registro existente e audita", async () => {
    db.query.mockResolvedValueOnce([[tabletAtual()]]).mockResolvedValueOnce([{ affectedRows: 1 }]);
    const res = createResponse();
    await tablets.deletarTablet(createRequest({ params: { id: "421" } }), res);
    expect(db.query).toHaveBeenLastCalledWith("DELETE FROM tablets WHERE idTab = ?", ["421"]);
    expect(registrarLog).toHaveBeenCalledWith(expect.objectContaining({ acao: "EXCLUSAO", entidadeId: 421 }));
  });
});
