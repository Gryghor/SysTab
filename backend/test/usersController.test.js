jest.mock("../src/config/db", () => ({ query: jest.fn() }));
jest.mock("../src/utils/logger", () => ({ registrarLog: jest.fn().mockResolvedValue(undefined) }));

const fs = require("fs");
const db = require("../src/config/db");
const { registrarLog } = require("../src/utils/logger");
const users = require("../src/controllers/usersController");
const { createResponse, createRequest } = require("./testUtils");

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe("arquivos de termo", () => {
  test("deleteTermo exclui arquivo existente", async () => {
    jest.spyOn(fs, "existsSync").mockReturnValue(true);
    jest.spyOn(fs, "unlinkSync").mockImplementation(() => {});
    const res = createResponse();
    await users.deleteTermo(createRequest({ params: { idUser: "10" } }), res);
    expect(fs.unlinkSync).toHaveBeenCalledWith(expect.stringMatching(/termo_10\.pdf$/));
    expect(res.statusCode).toBe(200);
  });

  test("deleteTermo devolve 404 para arquivo ausente", async () => {
    jest.spyOn(fs, "existsSync").mockReturnValue(false);
    const res = createResponse();
    await users.deleteTermo(createRequest({ params: { idUser: "10" } }), res);
    expect(res.statusCode).toBe(404);
  });

  test("uploadTermo exige arquivo e aceita PDF já salvo pelo middleware", async () => {
    const missing = createResponse();
    await users.uploadTermo(createRequest({ params: { idUser: "10" } }), missing);
    expect(missing.statusCode).toBe(400);
    const ok = createResponse();
    await users.uploadTermo(createRequest({ params: { idUser: "10" }, file: { filename: "termo_10.pdf" } }), ok);
    expect(ok.statusCode).toBe(201);
  });

  test("downloadTermo baixa existente e rejeita ausente", () => {
    jest.spyOn(fs, "existsSync").mockReturnValueOnce(true).mockReturnValueOnce(false);
    const ok = createResponse();
    users.downloadTermo(createRequest({ params: { idUser: "10" } }), ok);
    expect(ok.download).toHaveBeenCalledWith(expect.stringMatching(/termo_10\.pdf$/));
    const missing = createResponse();
    users.downloadTermo(createRequest({ params: { idUser: "11" } }), missing);
    expect(missing.statusCode).toBe(404);
  });

  test("viewTermo envia PDF inline", () => {
    const pipe = jest.fn();
    jest.spyOn(fs, "existsSync").mockReturnValue(true);
    jest.spyOn(fs, "createReadStream").mockReturnValue({ pipe });
    const res = createResponse();
    users.viewTermo(createRequest({ params: { idUser: "10" } }), res);
    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "application/pdf");
    expect(pipe).toHaveBeenCalledWith(res);
  });
});

describe("cadastro de usuários", () => {
  test("criarUsuario valida campos obrigatórios", async () => {
    const res = createResponse();
    await users.criarUsuario(createRequest({ body: { nomeUser: "Maria" } }), res);
    expect(res.statusCode).toBe(400);
    expect(db.query).not.toHaveBeenCalled();
  });

  test("criarUsuario insere e registra auditoria", async () => {
    db.query.mockResolvedValueOnce([{ insertId: 25 }]);
    const req = createRequest({ body: { nomeUser: "Maria", cpf: "123.456.789-09", telUser: "8199", idUnidade: 2 } });
    const res = createResponse();
    await users.criarUsuario(req, res);
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO usuarios"), ["Maria", "123.456.789-09", "8199", 2]);
    expect(registrarLog).toHaveBeenCalledWith(expect.objectContaining({ acao: "CRIACAO", entidade: "usuario", entidadeId: 25 }));
    expect(res.statusCode).toBe(201);
  });

  test("criarUsuario traduz CPF duplicado para 409", async () => {
    db.query.mockRejectedValueOnce({ code: "ER_DUP_ENTRY", sqlMessage: "Duplicate entry for key 'cpf'" });
    const res = createResponse();
    await users.criarUsuario(createRequest({ body: { nomeUser: "Maria", cpf: "123", idUnidade: 2 } }), res);
    expect(res.statusCode).toBe(409);
    expect(res.body.error).toContain("CPF");
  });

  test("listarUsuarios aplica unidade e mapeia vínculo e termo", async () => {
    db.query.mockResolvedValueOnce([[
      { idUser: 1, nomeUser: "Maria", cpf: "123", telUser: "81", idUnidade: 2, nomeUnidade: "USF", idTab: 8, idTomb: 203001, imei: "123456789012345" },
      { idUser: 2, nomeUser: "João", cpf: "456", telUser: null, idUnidade: 2, nomeUnidade: "USF", idTab: null },
    ]]);
    jest.spyOn(fs, "existsSync").mockReturnValueOnce(true).mockReturnValueOnce(false);
    const res = createResponse();
    await users.listarUsuarios(createRequest({ query: { unidade: "2" } }), res);
    expect(db.query.mock.calls[0][0]).toContain("WHERE u.idUnidade = ?");
    expect(res.body[0].tablet.idTab).toBe(8);
    expect(res.body[0].termoAssinado).toBe(true);
    expect(res.body[1].tablet).toBeNull();
  });

  test("editarUsuario devolve 404 quando id não existe", async () => {
    db.query.mockResolvedValueOnce([[]]);
    const res = createResponse();
    await users.editarUsuario(createRequest({ params: { id: "999" }, body: { nomeUser: "X", cpf: "123", idUnidade: 1 } }), res);
    expect(res.statusCode).toBe(404);
  });

  test("editarUsuario atualiza pelo id e registra antes/depois", async () => {
    db.query.mockResolvedValueOnce([[{ idUser: 5, nomeUser: "Antes", cpf: "111" }]]).mockResolvedValueOnce([{ affectedRows: 1 }]);
    const req = createRequest({ params: { id: "5" }, body: { nomeUser: "Depois", cpf: "222", telUser: "81", idUnidade: 2 } });
    const res = createResponse();
    await users.editarUsuario(req, res);
    expect(db.query.mock.calls[1]).toEqual([expect.stringContaining("UPDATE usuarios"), ["Depois", "222", "81", 2, "5"]]);
    expect(registrarLog).toHaveBeenCalledWith(expect.objectContaining({ acao: "EDICAO", entidadeId: 5 }));
  });

  test("deletarUsuario remove usuário sem tablet e registra auditoria", async () => {
    db.query.mockResolvedValueOnce([[{ idUser: 5, nomeUser: "Maria" }]]).mockResolvedValueOnce([[]]).mockResolvedValueOnce([{ affectedRows: 1 }]);
    const res = createResponse();
    await users.deletarUsuario(createRequest({ params: { id: "5" } }), res);
    expect(db.query).toHaveBeenLastCalledWith("DELETE FROM usuarios WHERE idUser = ?", ["5"]);
    expect(res.statusCode).toBe(200);
  });

  test("deletarUsuario bloqueia exclusão quando há tablet vinculado", async () => {
    db.query.mockResolvedValueOnce([[{ idUser: 5, nomeUser: "Maria" }]]).mockResolvedValueOnce([[{ idTab: 8, idTomb: 203001 }]]).mockResolvedValueOnce([{ affectedRows: 1 }]);
    const res = createResponse();
    await users.deletarUsuario(createRequest({ params: { id: "5" } }), res);
    expect(res.statusCode).toBe(409);
    expect(db.query).not.toHaveBeenCalledWith("DELETE FROM usuarios WHERE idUser = ?", ["5"]);
  });
});
