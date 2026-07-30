jest.mock("../src/config/db", () => ({ query: jest.fn() }));
jest.mock("jsonwebtoken", () => ({ verify: jest.fn() }));

const db = require("../src/config/db");
const jwt = require("jsonwebtoken");
const auth = require("../src/middlewares/authMiddleware");
const { createRequest, createResponse } = require("./testUtils");

beforeEach(() => jest.clearAllMocks());

test("aceita token de conta ativa com a mesma versão", async () => {
    jwt.verify.mockReturnValue({ idLogin: 2, nivel: "padrao", tokenVersion: 3 });
    db.query.mockResolvedValueOnce([[{ ativo: 1, tokenVersion: 3 }]]);
    const req = createRequest();
    req.headers = { authorization: "Bearer token" };
    const res = createResponse();
    const next = jest.fn();
    await auth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.usuario.idLogin).toBe(2);
});

test.each([
    [{ ativo: 0, tokenVersion: 3 }],
    [{ ativo: 1, tokenVersion: 4 }],
    [null],
])("rejeita conta inativa, sessão revogada ou conta ausente", async (conta) => {
    jwt.verify.mockReturnValue({ idLogin: 2, nivel: "padrao", tokenVersion: 3 });
    db.query.mockResolvedValueOnce([conta ? [conta] : []]);
    const req = createRequest();
    req.headers = { authorization: "Bearer token" };
    const res = createResponse();
    const next = jest.fn();
    await auth(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
});
