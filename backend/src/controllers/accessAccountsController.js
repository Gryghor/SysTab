const bcrypt = require("bcrypt");
const { randomBytes } = require("crypto");
const db = require("../config/db");
const { registrarLog } = require("../utils/logger");
const {
    encryptProvisionalPassword,
    decryptProvisionalPassword,
} = require("../utils/provisionalPasswordCrypto");

const NIVEIS_VALIDOS = new Set(["admin", "padrao"]);

function dadosConta(body = {}) {
    return {
        nome: String(body.nome || "").trim(),
        nivel: String(body.nivel || "padrao").trim().toLowerCase(),
    };
}

function validarConta(nome, nivel) {
    if (nome.length < 3 || nome.length > 100) {
        return "O nome de acesso deve ter entre 3 e 100 caracteres.";
    }
    if (!NIVEIS_VALIDOS.has(nivel)) {
        return "Nível de acesso inválido.";
    }
    return null;
}

function idValido(valor) {
    const id = Number(valor);
    return Number.isInteger(id) && id > 0 ? id : null;
}

function gerarSenhaProvisoria(nome) {
    const base = nome
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]/g, "")
        .slice(0, 10) || "usuario";
    return `${base}@${randomBytes(5).toString("hex")}A1`;
}

exports.listarContas = async (_req, res) => {
    try {
        const [rows] = await db.query(
            "SELECT idLogin, nome, nivel, ativo, mustChangePassword, provisionalPasswordEncrypted, criado_em FROM login ORDER BY nome ASC"
        );
        res.json(rows.map((row) => ({
            idLogin: row.idLogin,
            nome: row.nome,
            nivel: row.nivel,
            ativo: Boolean(row.ativo),
            trocaSenhaObrigatoria: Boolean(row.mustChangePassword),
            senhaProvisoriaDisponivel: Boolean(row.mustChangePassword && row.provisionalPasswordEncrypted),
            criado_em: row.criado_em,
        })));
    } catch (_err) {
        res.status(500).json({ error: "Erro ao listar contas de acesso." });
    }
};

exports.criarConta = async (req, res) => {
    const { nome, nivel } = dadosConta(req.body);
    const erro = validarConta(nome, nivel);
    if (erro) return res.status(400).json({ error: erro });

    try {
        const [existentes] = await db.query(
            "SELECT idLogin FROM login WHERE nome = ? LIMIT 1",
            [nome]
        );
        if (existentes.length > 0) {
            return res.status(409).json({ error: "Já existe uma conta com este nome de acesso." });
        }

        const senhaProvisoria = gerarSenhaProvisoria(nome);
        const senhaHash = await bcrypt.hash(senhaProvisoria, 12);
        const senhaCriptografada = encryptProvisionalPassword(senhaProvisoria);
        const [result] = await db.query(
            "INSERT INTO login (nome, senha, nivel, mustChangePassword, provisionalPasswordEncrypted) VALUES (?, ?, ?, 1, ?)",
            [nome, senhaHash, nivel, senhaCriptografada]
        );

        await registrarLog({
            acao: "CRIACAO",
            entidade: "login",
            entidadeId: result.insertId,
            req,
            detalhes: { nome, nivel, ativo: true, trocaSenhaObrigatoria: true },
        });

        res.status(201).json({
            message: "Conta criada. Entregue a senha provisória ao usuário.",
            senhaProvisoria,
            conta: {
                idLogin: result.insertId,
                nome,
                nivel,
                ativo: true,
                trocaSenhaObrigatoria: true,
            },
        });
    } catch (err) {
        if (err?.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ error: "Já existe uma conta com este nome de acesso." });
        }
        res.status(500).json({ error: "Erro ao criar conta de acesso." });
    }
};

exports.editarConta = async (req, res) => {
    const id = idValido(req.params.id);
    if (!id) return res.status(400).json({ error: "Conta inválida." });

    const { nome, nivel } = dadosConta(req.body);
    const erro = validarConta(nome, nivel);
    if (erro) return res.status(400).json({ error: erro });

    try {
        const [rows] = await db.query(
            "SELECT idLogin, nome, nivel, ativo, mustChangePassword FROM login WHERE idLogin = ?",
            [id]
        );
        const atual = rows[0];
        if (!atual) return res.status(404).json({ error: "Conta não encontrada." });

        if (Number(req.usuario.idLogin) === id) {
            return res.status(400).json({ error: "Você não pode editar sua própria conta administrativa." });
        }

        const [duplicadas] = await db.query(
            "SELECT idLogin FROM login WHERE nome = ? AND idLogin != ? LIMIT 1",
            [nome, id]
        );
        if (duplicadas.length > 0) {
            return res.status(409).json({ error: "Já existe uma conta com este nome de acesso." });
        }

        await db.query("UPDATE login SET nome = ?, nivel = ? WHERE idLogin = ?", [nome, nivel, id]);
        await registrarLog({
            acao: "EDICAO",
            entidade: "login",
            entidadeId: id,
            req,
            detalhes: {
                antes: { nome: atual.nome, nivel: atual.nivel, ativo: Boolean(atual.ativo) },
                depois: { nome, nivel, ativo: Boolean(atual.ativo) },
            },
        });

        res.json({
            message: "Conta atualizada com sucesso.",
            conta: {
                idLogin: id,
                nome,
                nivel,
                ativo: Boolean(atual.ativo),
                trocaSenhaObrigatoria: Boolean(atual.mustChangePassword),
            },
        });
    } catch (err) {
        if (err?.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ error: "Já existe uma conta com este nome de acesso." });
        }
        res.status(500).json({ error: "Erro ao atualizar conta de acesso." });
    }
};

exports.alterarStatus = async (req, res) => {
    const id = idValido(req.params.id);
    if (!id) return res.status(400).json({ error: "Conta inválida." });
    if (typeof req.body?.ativo !== "boolean") {
        return res.status(400).json({ error: "Informe se a conta deve ficar ativa ou inativa." });
    }
    const ativo = req.body.ativo;

    try {
        const [rows] = await db.query(
            "SELECT idLogin, nome, nivel, ativo FROM login WHERE idLogin = ?",
            [id]
        );
        const conta = rows[0];
        if (!conta) return res.status(404).json({ error: "Conta não encontrada." });
        if (Number(req.usuario.idLogin) === id && !ativo) {
            return res.status(400).json({ error: "Você não pode desativar sua própria conta." });
        }
        if (Boolean(conta.ativo) === ativo) {
            return res.status(400).json({ error: ativo ? "A conta já está ativa." : "A conta já está inativa." });
        }

        await db.query(
            "UPDATE login SET ativo = ?, tokenVersion = tokenVersion + 1 WHERE idLogin = ?",
            [ativo ? 1 : 0, id]
        );
        await registrarLog({
            acao: ativo ? "ATIVACAO" : "DESATIVACAO",
            entidade: "login",
            entidadeId: id,
            req,
            detalhes: { nome: conta.nome, nivel: conta.nivel, ativo },
        });

        res.json({ message: ativo ? "Conta ativada com sucesso." : "Conta desativada com sucesso." });
    } catch (_err) {
        res.status(500).json({ error: "Erro ao alterar status da conta." });
    }
};

exports.resetarSenha = async (req, res) => {
    const id = idValido(req.params.id);
    if (!id) return res.status(400).json({ error: "Conta inválida." });

    try {
        const [rows] = await db.query(
            "SELECT idLogin, nome, nivel FROM login WHERE idLogin = ?",
            [id]
        );
        const conta = rows[0];
        if (!conta) return res.status(404).json({ error: "Conta não encontrada." });
        if (Number(req.usuario?.idLogin) === id) {
            return res.status(400).json({ error: "Você não pode redefinir sua própria senha pela administração." });
        }

        const senhaProvisoria = gerarSenhaProvisoria(conta.nome);
        const senhaHash = await bcrypt.hash(senhaProvisoria, 12);
        const senhaCriptografada = encryptProvisionalPassword(senhaProvisoria);
        await db.query(
            "UPDATE login SET senha = ?, mustChangePassword = 1, provisionalPasswordEncrypted = ?, tokenVersion = tokenVersion + 1 WHERE idLogin = ?",
            [senhaHash, senhaCriptografada, id]
        );
        await registrarLog({
            acao: "RESET_SENHA",
            entidade: "login",
            entidadeId: id,
            req,
            detalhes: { nome: conta.nome, nivel: conta.nivel, trocaSenhaObrigatoria: true },
        });

        res.json({
            message: "Senha provisória gerada. As sessões atuais foram encerradas.",
            senhaProvisoria,
            conta: { idLogin: id, nome: conta.nome },
        });
    } catch (_err) {
        res.status(500).json({ error: "Erro ao redefinir senha." });
    }
};

exports.mostrarSenhaProvisoria = async (req, res) => {
    const id = idValido(req.params.id);
    if (!id) return res.status(400).json({ error: "Conta inválida." });

    try {
        const [rows] = await db.query(
            "SELECT idLogin, nome, mustChangePassword, provisionalPasswordEncrypted FROM login WHERE idLogin = ?",
            [id]
        );
        const conta = rows[0];
        if (!conta) return res.status(404).json({ error: "Conta não encontrada." });
        if (!Boolean(conta.mustChangePassword) || !conta.provisionalPasswordEncrypted) {
            return res.status(404).json({
                error: "Esta conta não possui senha provisória disponível.",
            });
        }

        const senhaProvisoria = decryptProvisionalPassword(conta.provisionalPasswordEncrypted);
        await registrarLog({
            acao: "CONSULTA_SENHA_PROVISORIA",
            entidade: "login",
            entidadeId: id,
            req,
            detalhes: { nome: conta.nome },
        });
        res.json({
            conta: { idLogin: id, nome: conta.nome },
            senhaProvisoria,
        });
    } catch (_err) {
        res.status(500).json({ error: "Erro ao consultar a senha provisória." });
    }
};
