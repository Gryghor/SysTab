jest.mock("../src/config/db", () => ({ query: jest.fn() }));
jest.mock("../src/utils/logger", () => ({ registrarLog: jest.fn().mockResolvedValue(undefined) }));
jest.mock("bcrypt", () => ({ hash: jest.fn().mockResolvedValue("hash-seguro") }));

const db = require("../src/config/db");
const contas = require("../src/controllers/accessAccountsController");
const { createRequest, createResponse } = require("./testUtils");

beforeEach(() => jest.clearAllMocks());

test("listagem devolve erro controlado quando o banco falha", async () => {
    db.query.mockRejectedValueOnce(new Error("db"));
    const res = createResponse();
    await contas.listarContas(createRequest(), res);
    expect(res.statusCode).toBe(500);
});

test("criação rejeita nome duplicado", async () => {
    db.query.mockResolvedValueOnce([[{ idLogin: 2 }]]);
    const res = createResponse();
    await contas.criarConta(createRequest({
        body: { nome: "operador", nivel: "padrao" },
    }), res);
    expect(res.statusCode).toBe(409);
});

test("edição rejeita id inválido, dados inválidos e conta ausente", async () => {
    let res = createResponse();
    await contas.editarConta(createRequest({ params: { id: "x" }, body: {} }), res);
    expect(res.statusCode).toBe(400);

    res = createResponse();
    await contas.editarConta(createRequest({
        params: { id: "2" }, body: { nome: "x", nivel: "padrao" },
    }), res);
    expect(res.statusCode).toBe(400);

    db.query.mockResolvedValueOnce([[]]);
    res = createResponse();
    await contas.editarConta(createRequest({
        params: { id: "2" }, body: { nome: "operador", nivel: "padrao" },
    }), res);
    expect(res.statusCode).toBe(404);
});

test("edição rejeita nome utilizado por outra conta", async () => {
    db.query
        .mockResolvedValueOnce([[{ idLogin: 2, nome: "antes", nivel: "padrao", ativo: 1 }]])
        .mockResolvedValueOnce([[{ idLogin: 3 }]]);
    const res = createResponse();
    await contas.editarConta(createRequest({
        params: { id: "2" }, body: { nome: "existente", nivel: "padrao" },
        usuario: { idLogin: 1, nivel: "admin" },
    }), res);
    expect(res.statusCode).toBe(409);
});

test("status exige booleano e rejeita conta ausente ou status repetido", async () => {
    let res = createResponse();
    await contas.alterarStatus(createRequest({ params: { id: "2" }, body: { ativo: "não" } }), res);
    expect(res.statusCode).toBe(400);

    db.query.mockResolvedValueOnce([[]]);
    res = createResponse();
    await contas.alterarStatus(createRequest({ params: { id: "2" }, body: { ativo: true } }), res);
    expect(res.statusCode).toBe(404);

    db.query.mockResolvedValueOnce([[{ idLogin: 2, nome: "operador", nivel: "padrao", ativo: 1 }]]);
    res = createResponse();
    await contas.alterarStatus(createRequest({
        params: { id: "2" }, body: { ativo: true },
        usuario: { idLogin: 1, nivel: "admin" },
    }), res);
    expect(res.statusCode).toBe(400);
});

test("reativa conta inativa", async () => {
    db.query
        .mockResolvedValueOnce([[{ idLogin: 2, nome: "operador", nivel: "padrao", ativo: 0 }]])
        .mockResolvedValueOnce([{ affectedRows: 1 }]);
    const res = createResponse();
    await contas.alterarStatus(createRequest({
        params: { id: "2" }, body: { ativo: true },
        usuario: { idLogin: 1, nivel: "admin" },
    }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.message).toContain("ativada");
});

test("reset rejeita id inválido e conta ausente", async () => {
    let res = createResponse();
    await contas.resetarSenha(createRequest({ params: { id: "x" } }), res);
    expect(res.statusCode).toBe(400);

    db.query.mockResolvedValueOnce([[]]);
    res = createResponse();
    await contas.resetarSenha(createRequest({ params: { id: "2" } }), res);
    expect(res.statusCode).toBe(404);
});
