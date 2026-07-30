jest.mock("../src/config/db", () => ({ query: jest.fn() }));
jest.mock("../src/utils/logger", () => ({ registrarLog: jest.fn().mockResolvedValue(undefined) }));
jest.mock("bcrypt", () => ({ compare: jest.fn(), hash: jest.fn().mockResolvedValue("hash-novo") }));
jest.mock("jsonwebtoken", () => ({ sign: jest.fn(() => "token"), verify: jest.fn() }));

const db = require("../src/config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const authController = require("../src/controllers/authController");
const authMiddleware = require("../src/middlewares/authMiddleware");
const { createRequest, createResponse } = require("./testUtils");

beforeEach(() => jest.clearAllMocks());

test("login informa e assina a troca obrigatória", async () => {
    db.query.mockResolvedValueOnce([[{
        idLogin: 4, nome: "maria", senha: "hash", nivel: "padrao",
        ativo: 1, tokenVersion: 2, mustChangePassword: 1,
    }]]);
    bcrypt.compare.mockResolvedValueOnce(true);
    const res = createResponse();
    await authController.login(createRequest({ body: { nome: "maria", senha: "provisoria" } }), res);
    expect(res.body.usuario.trocaSenhaObrigatoria).toBe(true);
    expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({ idLogin: 4, trocaSenhaObrigatoria: true, tokenVersion: 2 }),
        expect.any(String),
        { expiresIn: "1d" },
    );
});

test("middleware bloqueia as demais rotas enquanto a troca está pendente", async () => {
    jwt.verify.mockReturnValue({ idLogin: 4, tokenVersion: 2 });
    db.query.mockResolvedValueOnce([[{ ativo: 1, tokenVersion: 2, mustChangePassword: 1 }]]);
    const req = createRequest();
    req.headers = { authorization: "Bearer token" };
    req.originalUrl = "/tablets";
    const res = createResponse();
    const next = jest.fn();
    await authMiddleware(req, res, next);
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe("PASSWORD_CHANGE_REQUIRED");
    expect(next).not.toHaveBeenCalled();
});

test("middleware permite somente a rota de troca obrigatória", async () => {
    jwt.verify.mockReturnValue({ idLogin: 4, tokenVersion: 2 });
    db.query.mockResolvedValueOnce([[{ ativo: 1, tokenVersion: 2, mustChangePassword: 1 }]]);
    const req = createRequest();
    req.headers = { authorization: "Bearer token" };
    req.originalUrl = "/auth/primeiro-acesso/senha";
    const res = createResponse();
    const next = jest.fn();
    await authMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
});

test("troca a senha provisória, limpa pendência e revoga o token", async () => {
    db.query
        .mockResolvedValueOnce([[{
            idLogin: 4, nome: "maria", senha: "hash-antigo", mustChangePassword: 1,
        }]])
        .mockResolvedValueOnce([{ affectedRows: 1 }]);
    bcrypt.compare.mockResolvedValueOnce(false);
    const res = createResponse();
    await authController.alterarSenhaPrimeiroAcesso(createRequest({
        body: { novaSenha: "NovaSenhaSegura!" },
        usuario: { idLogin: 4 },
    }), res);
    expect(res.statusCode).toBe(200);
    expect(bcrypt.hash).toHaveBeenCalledWith("NovaSenhaSegura!", 12);
    expect(db.query).toHaveBeenLastCalledWith(
        "UPDATE login SET senha = ?, mustChangePassword = 0, provisionalPasswordEncrypted = NULL, tokenVersion = tokenVersion + 1 WHERE idLogin = ?",
        ["hash-novo", 4],
    );
});

test("rejeita senha curta, ausência de pendência e reutilização da provisória", async () => {
    let res = createResponse();
    await authController.alterarSenhaPrimeiroAcesso(createRequest({
        body: { novaSenha: "curta" }, usuario: { idLogin: 4 },
    }), res);
    expect(res.statusCode).toBe(400);

    db.query.mockResolvedValueOnce([[{ idLogin: 4, mustChangePassword: 0 }]]);
    res = createResponse();
    await authController.alterarSenhaPrimeiroAcesso(createRequest({
        body: { novaSenha: "NovaSenhaSegura!" }, usuario: { idLogin: 4 },
    }), res);
    expect(res.statusCode).toBe(400);

    db.query.mockResolvedValueOnce([[{
        idLogin: 4, nome: "maria", senha: "hash-antigo", mustChangePassword: 1,
    }]]);
    bcrypt.compare.mockResolvedValueOnce(true);
    res = createResponse();
    await authController.alterarSenhaPrimeiroAcesso(createRequest({
        body: { novaSenha: "NovaSenhaSegura!" }, usuario: { idLogin: 4 },
    }), res);
    expect(res.statusCode).toBe(400);
});
