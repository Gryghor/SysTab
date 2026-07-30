jest.mock("../src/config/db", () => ({ query: jest.fn() }));
jest.mock("../src/utils/logger", () => ({ registrarLog: jest.fn().mockResolvedValue(undefined) }));
jest.mock("../src/utils/provisionalPasswordCrypto", () => ({ encryptProvisionalPassword: jest.fn(() => "senha-criptografada"), decryptProvisionalPassword: jest.fn(() => "senha-provisoria") }));
jest.mock("bcrypt", () => ({ hash: jest.fn().mockResolvedValue("hash-seguro") }));
jest.mock("crypto", () => ({ randomBytes: jest.fn(() => Buffer.from("a1b2c3d4e5", "hex")) }));

const bcrypt = require("bcrypt");
const db = require("../src/config/db");
const { registrarLog } = require("../src/utils/logger");
const contas = require("../src/controllers/accessAccountsController");
const { createRequest, createResponse } = require("./testUtils");

beforeEach(() => jest.clearAllMocks());

test("lista contas sem selecionar hashes nem versões de token", async () => {
    db.query.mockResolvedValueOnce([[{
        idLogin: 1, nome: "admin", nivel: "admin", ativo: 1,
        mustChangePassword: 1, criado_em: new Date("2026-01-01"),
    }]]);
    const res = createResponse();
    await contas.listarContas(createRequest(), res);
    expect(res.statusCode).toBe(200);
    expect(res.body[0]).toEqual(expect.objectContaining({
        nome: "admin", ativo: true, trocaSenhaObrigatoria: true,
    }));
    expect(res.body[0]).not.toHaveProperty("senha");
    expect(res.body[0]).not.toHaveProperty("tokenVersion");
    expect(res.body[0].mustChangePassword).toBeUndefined();
});

test("rejeita dados inválidos antes de consultar o banco", async () => {
    for (const body of [
        { nome: "ab", nivel: "padrao" },
        { nome: "operador", nivel: "superuser" },
    ]) {
        const res = createResponse();
        await contas.criarConta(createRequest({ body }), res);
        expect(res.statusCode).toBe(400);
    }
    expect(db.query).not.toHaveBeenCalled();
});

test("cria conta com senha provisória baseada no nome e auditoria", async () => {
    db.query.mockResolvedValueOnce([[]]).mockResolvedValueOnce([{ insertId: 7 }]);
    const req = createRequest({
        body: { nome: " operador ", nivel: "PADRAO" },
        usuario: { idLogin: 1, nivel: "admin" },
    });
    const res = createResponse();
    await contas.criarConta(req, res);
    expect(bcrypt.hash).toHaveBeenCalledWith("operador@a1b2c3d4e5A1", 12);
    expect(db.query).toHaveBeenLastCalledWith(
        "INSERT INTO login (nome, senha, nivel, mustChangePassword, provisionalPasswordEncrypted) VALUES (?, ?, ?, 1, ?)",
        ["operador", "hash-seguro", "padrao", "senha-criptografada"],
    );
    expect(res.statusCode).toBe(201);
    expect(res.body.conta).toEqual({
        idLogin: 7, nome: "operador", nivel: "padrao", ativo: true,
        trocaSenhaObrigatoria: true,
    });
    expect(res.body.senhaProvisoria).toBe("operador@a1b2c3d4e5A1");
    expect(registrarLog).toHaveBeenCalledWith(expect.objectContaining({ acao: "CRIACAO", entidade: "login" }));
});

test("edita nome e nível, preservando o status e validando duplicidade", async () => {
    db.query
        .mockResolvedValueOnce([[{
            idLogin: 2, nome: "antes", nivel: "padrao", ativo: 1, mustChangePassword: 0,
        }]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([{ affectedRows: 1 }]);
    const res = createResponse();
    await contas.editarConta(createRequest({
        params: { id: "2" },
        body: { nome: "depois", nivel: "admin" },
        usuario: { idLogin: 1, nivel: "admin" },
    }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.conta).toEqual({
        idLogin: 2, nome: "depois", nivel: "admin", ativo: true,
        trocaSenhaObrigatoria: false,
    });
    expect(db.query.mock.calls[1]).toEqual([
        "SELECT idLogin FROM login WHERE nome = ? AND idLogin != ? LIMIT 1",
        ["depois", 2],
    ]);
    expect(registrarLog).toHaveBeenCalledWith(expect.objectContaining({ acao: "EDICAO" }));
});

test("impede admin de remover o próprio nível", async () => {
    db.query.mockResolvedValueOnce([[{ idLogin: 1, nome: "admin", nivel: "admin", ativo: 1 }]]);
    const res = createResponse();
    await contas.editarConta(createRequest({
        params: { id: "1" },
        body: { nome: "admin", nivel: "padrao" },
        usuario: { idLogin: 1, nivel: "admin" },
    }), res);
    expect(res.statusCode).toBe(400);
    expect(db.query).toHaveBeenCalledTimes(1);
});

test("desativa conta e incrementa versão de token", async () => {
    db.query
        .mockResolvedValueOnce([[{ idLogin: 2, nome: "operador", nivel: "padrao", ativo: 1 }]])
        .mockResolvedValueOnce([{ affectedRows: 1 }]);
    const res = createResponse();
    await contas.alterarStatus(createRequest({
        params: { id: "2" }, body: { ativo: false },
        usuario: { idLogin: 1, nivel: "admin" },
    }), res);
    expect(res.statusCode).toBe(200);
    expect(db.query).toHaveBeenLastCalledWith(
        "UPDATE login SET ativo = ?, tokenVersion = tokenVersion + 1 WHERE idLogin = ?",
        [0, 2],
    );
});

test("impede desativação da própria conta", async () => {
    db.query.mockResolvedValueOnce([[{ idLogin: 1, nome: "admin", nivel: "admin", ativo: 1 }]]);
    const res = createResponse();
    await contas.alterarStatus(createRequest({
        params: { id: "1" }, body: { ativo: false },
        usuario: { idLogin: 1, nivel: "admin" },
    }), res);
    expect(res.statusCode).toBe(400);
});

test("reset gera senha provisória, exige troca e revoga sessões", async () => {
    db.query
        .mockResolvedValueOnce([[{ idLogin: 2, nome: "operador", nivel: "padrao" }]])
        .mockResolvedValueOnce([{ affectedRows: 1 }]);
    const res = createResponse();
    await contas.resetarSenha(createRequest({ params: { id: "2" } }), res);
    expect(res.statusCode).toBe(200);
    expect(bcrypt.hash).toHaveBeenCalledWith("operador@a1b2c3d4e5A1", 12);
    expect(db.query).toHaveBeenLastCalledWith(
        "UPDATE login SET senha = ?, mustChangePassword = 1, provisionalPasswordEncrypted = ?, tokenVersion = tokenVersion + 1 WHERE idLogin = ?",
        ["hash-seguro", "senha-criptografada", 2],
    );
    expect(res.body.senhaProvisoria).toBe("operador@a1b2c3d4e5A1");
    expect(registrarLog).toHaveBeenCalledWith(expect.objectContaining({ acao: "RESET_SENHA" }));
});
