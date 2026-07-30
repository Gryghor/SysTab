const express = require("express");
const request = require("supertest");

jest.mock("../src/config/db", () => ({ query: jest.fn() }));
jest.mock("bcrypt", () => ({ compare: jest.fn() }));
jest.mock("../src/middlewares/authMiddleware", () => (req, res, next) => next());
jest.mock("../src/config/uploadsConfig", () => ({ single: () => (req, res, next) => next() }));
jest.mock("../src/controllers/usersController", () => ({
  deleteTermo: (req, res) => res.status(204).end(),
  uploadTermo: (req, res) => res.status(204).end(),
  downloadTermo: (req, res) => res.status(204).end(),
  viewTermo: (req, res) => res.status(204).end(),
  criarUsuario: (req, res) => res.status(204).end(),
  listarUsuarios: (req, res) => res.status(204).end(),
  editarUsuario: (req, res) => res.status(204).end(),
  deletarUsuario: (req, res) => res.status(204).end(),
}));
jest.mock("../src/controllers/tabletsController", () => ({
  criarTablet: (req, res) => res.status(204).end(),
  listarTablets: (req, res) => res.status(204).end(),
  buscarTablet: (req, res) => res.status(204).end(),
  buscarTabletPorId: (req, res) => res.status(204).end(),
  gerarTermoResponsabilidade: (req, res) => res.status(204).end(),
  editarTablet: (req, res) => res.status(204).end(),
  remanejarTablet: (req, res) => res.status(204).end(),
  deletarTablet: (req, res) => res.status(204).end(),
}));
jest.mock("../src/controllers/empresasController", () => ({
  criarEmpresa: (req, res) => res.status(204).end(),
  listarEmpresas: (req, res) => res.status(204).end(),
  deletarEmpresa: (req, res) => res.status(204).end(),
}));
jest.mock("../src/controllers/regionaisController", () => ({
  criarRegional: (req, res) => res.status(204).end(),
  listarRegionais: (req, res) => res.status(204).end(),
  editarRegional: (req, res) => res.status(204).end(),
  deletarRegional: (req, res) => res.status(204).end(),
}));

const usersRoutes = require("../src/routes/usersRoutes");
const tabletsRoutes = require("../src/routes/tabletsRoutes");
const empresasRoutes = require("../src/routes/empresasRoutes");
const regionaisRoutes = require("../src/routes/regRoutes");

function appFor(router) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    const nivel = req.get("x-test-role") || "padrao";
    req.usuario = { idLogin: nivel === "admin" ? 1 : 2, nivel, role: nivel };
    next();
  });
  app.use(router);
  return app;
}

const usersApp = appFor(usersRoutes);
const tabletsApp = appFor(tabletsRoutes);
const empresasApp = appFor(empresasRoutes);
const regionaisApp = appFor(regionaisRoutes);

describe("autorização das rotas de usuários", () => {
  test("perfil padrão cria usuário", async () => {
    expect((await request(usersApp).post("/").set("x-test-role", "padrao").send({})).status).toBe(204);
  });

  test("perfil padrão edita usuário", async () => {
    expect((await request(usersApp).put("/10").set("x-test-role", "padrao").send({})).status).toBe(204);
  });

  test("perfil padrão não exclui usuário", async () => {
    expect((await request(usersApp).delete("/10").set("x-test-role", "padrao")).status).toBe(403);
  });

  test("perfil padrão pode anexar termo assinado", async () => {
    expect((await request(usersApp).post("/10/termo/upload").set("x-test-role", "padrao")).status).toBe(204);
  });

  test("perfil padrão não exclui termo assinado", async () => {
    expect((await request(usersApp).delete("/10/termo").set("x-test-role", "padrao")).status).toBe(403);
  });

  test("admin alcança mutações de usuário", async () => {
    expect((await request(usersApp).post("/").set("x-test-role", "admin").send({})).status).toBe(204);
    expect((await request(usersApp).put("/10").set("x-test-role", "admin").send({})).status).toBe(204);
    expect((await request(usersApp).delete("/10").set("x-test-role", "admin")).status).toBe(204);
  });
});

describe("autorização das rotas de tablets", () => {
  test("perfil padrão cria tablet", async () => {
    expect((await request(tabletsApp).post("/").set("x-test-role", "padrao").send({})).status).toBe(204);
  });

  test("perfil padrão edita metadados do tablet", async () => {
    expect((await request(tabletsApp).put("/10").set("x-test-role", "padrao").send({})).status).toBe(204);
  });

  test("perfil padrão remaneja ou desvincula tablet", async () => {
    expect((await request(tabletsApp).post("/10/remanejar").set("x-test-role", "padrao").send({ idUserDestino: null })).status).toBe(204);
  });

  test("perfil padrão não exclui tablet", async () => {
    expect((await request(tabletsApp).delete("/10").set("x-test-role", "padrao")).status).toBe(403);
  });

  test("admin alcança mutações de tablet", async () => {
    expect((await request(tabletsApp).post("/").set("x-test-role", "admin").send({})).status).toBe(204);
    expect((await request(tabletsApp).put("/10").set("x-test-role", "admin").send({})).status).toBe(204);
    expect((await request(tabletsApp).post("/10/remanejar").set("x-test-role", "admin").send({})).status).toBe(204);
    expect((await request(tabletsApp).delete("/10").set("x-test-role", "admin")).status).toBe(204);
  });
});

describe("autorização de empresas e regionais", () => {
  test("perfil padrão não cria empresa", async () => {
    expect((await request(empresasApp).post("/").set("x-test-role", "padrao").send({})).status).toBe(403);
  });

  test("perfil padrão não exclui empresa", async () => {
    expect((await request(empresasApp).delete("/1").set("x-test-role", "padrao")).status).toBe(403);
  });

  test("perfil padrão não cria regional", async () => {
    expect((await request(regionaisApp).post("/").set("x-test-role", "padrao").send({})).status).toBe(403);
  });

  test("perfil padrão não edita regional", async () => {
    expect((await request(regionaisApp).put("/1").set("x-test-role", "padrao").send({})).status).toBe(403);
  });

  test("perfil padrão não exclui regional", async () => {
    expect((await request(regionaisApp).delete("/1").set("x-test-role", "padrao")).status).toBe(403);
  });

  test("admin alcança mutações de empresas e regionais", async () => {
    expect((await request(empresasApp).post("/").set("x-test-role", "admin").send({})).status).toBe(204);
    expect((await request(empresasApp).delete("/1").set("x-test-role", "admin")).status).toBe(204);
    expect((await request(regionaisApp).post("/").set("x-test-role", "admin").send({})).status).toBe(204);
    expect((await request(regionaisApp).put("/1").set("x-test-role", "admin").send({})).status).toBe(204);
    expect((await request(regionaisApp).delete("/1").set("x-test-role", "admin")).status).toBe(204);
  });
});

test("backend recusa inicialização em produção sem JWT_SECRET explícito", () => {
  const original = process.env.JWT_SECRET;
  const originalNodeEnv = process.env.NODE_ENV;
  delete process.env.JWT_SECRET;
  process.env.NODE_ENV = "production";
  jest.resetModules();
  expect(() => require("../src/controllers/authController")).toThrow(/JWT_SECRET/);
  if (original !== undefined) process.env.JWT_SECRET = original;
  process.env.NODE_ENV = originalNodeEnv;
});
