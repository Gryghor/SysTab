jest.mock("../src/config/db", () => ({ query: jest.fn() }));
jest.mock("../src/utils/logger", () => ({ registrarLog: jest.fn().mockResolvedValue(undefined) }));
jest.mock("bcrypt", () => ({ hash: jest.fn() }));

const db = require("../src/config/db");
const bcrypt = require("bcrypt");
const contas = require("../src/controllers/accessAccountsController");
const { createRequest, createResponse } = require("./testUtils");

beforeEach(() => jest.clearAllMocks());

test("administrador não pode editar a própria conta", async () => {
    db.query.mockResolvedValueOnce([[{
        idLogin: 1, nome: "admin", nivel: "admin", ativo: 1, mustChangePassword: 0,
    }]]);
    const res = createResponse();
    await contas.editarConta(createRequest({
        params: { id: "1" },
        body: { nome: "admin-alterado", nivel: "admin" },
        usuario: { idLogin: 1, nivel: "admin" },
    }), res);
    expect(res.statusCode).toBe(400);
    expect(db.query).toHaveBeenCalledTimes(1);
});

test("administrador não pode resetar a própria senha", async () => {
    db.query.mockResolvedValueOnce([[{
        idLogin: 1, nome: "admin", nivel: "admin",
    }]]);
    const res = createResponse();
    await contas.resetarSenha(createRequest({
        params: { id: "1" },
        usuario: { idLogin: 1, nivel: "admin" },
    }), res);
    expect(res.statusCode).toBe(400);
    expect(bcrypt.hash).not.toHaveBeenCalled();
    expect(db.query).toHaveBeenCalledTimes(1);
});
