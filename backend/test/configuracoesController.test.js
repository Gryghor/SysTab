jest.mock("../src/config/db", () => ({ query: jest.fn() }));
jest.mock("../src/utils/logger", () => ({ registrarLog: jest.fn().mockResolvedValue(undefined) }));

const db = require("../src/config/db");
const { registrarLog } = require("../src/utils/logger");
const configuracoes = require("../src/controllers/configuracoesController");
const { createResponse, createRequest } = require("./testUtils");

beforeEach(() => jest.clearAllMocks());

describe("configuração de obrigatoriedade do CPF", () => {
  test("retorna o valor persistido", async () => {
    db.query.mockResolvedValueOnce([[{ valor: "0" }]]);
    const res = createResponse();

    await configuracoes.obterConfiguracoes(createRequest(), res);

    expect(res.body).toEqual({ cpfObrigatorio: false });
  });

  test("usa o padrão quando a configuração ainda não existe", async () => {
    db.query.mockResolvedValueOnce([[]]);
    expect(await configuracoes.lerCpfObrigatorio()).toBe(true);
  });

  test("usa o padrão quando não consegue consultar a configuração", async () => {
    db.query.mockRejectedValueOnce(new Error("tabela ausente"));
    expect(await configuracoes.lerCpfObrigatorio()).toBe(true);
  });

  test("rejeita valor inválido", async () => {
    const res = createResponse();

    await configuracoes.atualizarCpfObrigatorio(createRequest({ body: { obrigatorio: "false" } }), res);

    expect(res.statusCode).toBe(400);
    expect(db.query).not.toHaveBeenCalled();
  });

  test("persiste alteração e registra auditoria", async () => {
    db.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
    const req = createRequest({ body: { obrigatorio: false } });
    const res = createResponse();

    await configuracoes.atualizarCpfObrigatorio(req, res);

    expect(db.query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO configuracoes"), ["cpf_obrigatorio", "0"]);
    expect(registrarLog).toHaveBeenCalledWith(expect.objectContaining({ acao: "ALTERACAO_CONFIGURACAO" }));
    expect(res.body.cpfObrigatorio).toBe(false);
  });
});
