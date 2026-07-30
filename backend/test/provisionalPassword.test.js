jest.mock("../src/config/db", () => ({ query: jest.fn() }));
jest.mock("../src/utils/logger", () => ({ registrarLog: jest.fn().mockResolvedValue(undefined) }));
jest.mock("../src/utils/provisionalPasswordCrypto", () => ({
    encryptProvisionalPassword: jest.fn(),
    decryptProvisionalPassword: jest.fn(() => "maria@provisoriaA1"),
}));

const db = require("../src/config/db");
const { registrarLog } = require("../src/utils/logger");
const { decryptProvisionalPassword } = require("../src/utils/provisionalPasswordCrypto");
const contas = require("../src/controllers/accessAccountsController");
const { createRequest, createResponse } = require("./testUtils");

beforeEach(() => jest.clearAllMocks());

test("admin recupera a senha provisória criptografada enquanto a troca está pendente", async () => {
    db.query.mockResolvedValueOnce([[{
        idLogin: 8,
        nome: "maria",
        mustChangePassword: 1,
        provisionalPasswordEncrypted: "payload-criptografado",
    }]]);
    const req = createRequest({ params: { id: "8" }, usuario: { idLogin: 1, nivel: "admin" } });
    const res = createResponse();
    await contas.mostrarSenhaProvisoria(req, res);
    expect(res.statusCode).toBe(200);
    expect(decryptProvisionalPassword).toHaveBeenCalledWith("payload-criptografado");
    expect(res.body).toEqual({
        conta: { idLogin: 8, nome: "maria" },
        senhaProvisoria: "maria@provisoriaA1",
    });
    expect(registrarLog).toHaveBeenCalledWith(expect.objectContaining({
        acao: "CONSULTA_SENHA_PROVISORIA",
        entidadeId: 8,
    }));
});

test("senha deixa de ser recuperável depois da troca", async () => {
    db.query.mockResolvedValueOnce([[{
        idLogin: 8,
        nome: "maria",
        mustChangePassword: 0,
        provisionalPasswordEncrypted: null,
    }]]);
    const res = createResponse();
    await contas.mostrarSenhaProvisoria(createRequest({ params: { id: "8" } }), res);
    expect(res.statusCode).toBe(404);
    expect(decryptProvisionalPassword).not.toHaveBeenCalled();
});

test("criptografia autenticada recupera somente o valor original", () => {
    jest.resetModules();
    jest.unmock("../src/utils/provisionalPasswordCrypto");
    const crypto = require("../src/utils/provisionalPasswordCrypto");
    const original = "usuario@SenhaProvisoriaA1";
    const encrypted = crypto.encryptProvisionalPassword(original);
    expect(encrypted).not.toContain(original);
    expect(crypto.decryptProvisionalPassword(encrypted)).toBe(original);
});
