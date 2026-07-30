jest.mock("../src/middlewares/authMiddleware", () => (req, _res, next) => {
    req.usuario = { idLogin: 1, nivel: req.headers["x-test-role"] || "padrao" };
    next();
});
jest.mock("../src/controllers/accessAccountsController", () => ({
    listarContas: (_req, res) => res.status(204).end(),
    criarConta: (_req, res) => res.status(204).end(),
    editarConta: (_req, res) => res.status(204).end(),
    mostrarSenhaProvisoria: (_req, res) => res.status(204).end(),
    alterarStatus: (_req, res) => res.status(204).end(),
    resetarSenha: (_req, res) => res.status(204).end(),
}));

const express = require("express");
const request = require("supertest");
const routes = require("../src/routes/accessAccountsRoutes");

const app = express();
app.use(express.json());
app.use("/", routes);

test("perfil padrão não gerencia contas", async () => {
    expect((await request(app).get("/").set("x-test-role", "padrao")).status).toBe(403);
    expect((await request(app).post("/").set("x-test-role", "padrao")).status).toBe(403);
    expect((await request(app).put("/2").set("x-test-role", "padrao")).status).toBe(403);
    expect((await request(app).get("/2/senha-provisoria").set("x-test-role", "padrao")).status).toBe(403);
    expect((await request(app).patch("/2/status").set("x-test-role", "padrao")).status).toBe(403);
    expect((await request(app).patch("/2/senha").set("x-test-role", "padrao")).status).toBe(403);
});

test("admin alcança todas as operações de contas", async () => {
    expect((await request(app).get("/").set("x-test-role", "admin")).status).toBe(204);
    expect((await request(app).post("/").set("x-test-role", "admin")).status).toBe(204);
    expect((await request(app).put("/2").set("x-test-role", "admin")).status).toBe(204);
    expect((await request(app).get("/2/senha-provisoria").set("x-test-role", "admin")).status).toBe(204);
    expect((await request(app).patch("/2/status").set("x-test-role", "admin")).status).toBe(204);
    expect((await request(app).patch("/2/senha").set("x-test-role", "admin")).status).toBe(204);
});
