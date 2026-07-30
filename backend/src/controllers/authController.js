const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../config/db");
const { JWT_SECRET } = require("../config/authConfig");
const { registrarLog } = require("../utils/logger");

function validarNovaSenha(senha) {
    if (typeof senha !== "string" || senha.length < 8 || senha.length > 128) {
        return "A nova senha deve ter entre 8 e 128 caracteres.";
    }
    return null;
}

exports.login = async (req, res) => {
    const { nome, senha } = req.body;
    try {
        const [result] = await db.query("SELECT * FROM login WHERE nome = ?", [nome]);
        const user = result[0];
        if (!user || user.ativo === 0) {
            return res.status(401).json({ error: "Usuário ou senha inválidos" });
        }

        const valid = await bcrypt.compare(senha, user.senha);
        if (!valid) return res.status(401).json({ error: "Usuário ou senha inválidos" });

        const payload = { idLogin: user.idLogin, nivel: user.nivel, role: user.nivel };
        const usuario = { nome: user.nome, nivel: user.nivel, role: user.nivel };
        if (user.mustChangePassword !== undefined) {
            const trocaSenhaObrigatoria = Boolean(user.mustChangePassword);
            payload.trocaSenhaObrigatoria = trocaSenhaObrigatoria;
            usuario.trocaSenhaObrigatoria = trocaSenhaObrigatoria;
        }
        if (user.tokenVersion !== undefined) {
            payload.tokenVersion = Number(user.tokenVersion || 0);
        }
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "1d" });
        res.json({ token, usuario });
    } catch (error) {
        console.error("Erro no login:", error);
        res.status(500).json({ error: "Erro no login" });
    }
};

exports.alterarSenhaPrimeiroAcesso = async (req, res) => {
    const novaSenha = String(req.body?.novaSenha || "");
    const erro = validarNovaSenha(novaSenha);
    if (erro) return res.status(400).json({ error: erro });

    try {
        const [rows] = await db.query(
            "SELECT idLogin, nome, senha, mustChangePassword FROM login WHERE idLogin = ?",
            [req.usuario.idLogin]
        );
        const conta = rows[0];
        if (!conta) return res.status(404).json({ error: "Conta não encontrada." });
        if (!Boolean(conta.mustChangePassword)) {
            return res.status(400).json({ error: "Esta conta não possui troca de senha pendente." });
        }
        if (await bcrypt.compare(novaSenha, conta.senha)) {
            return res.status(400).json({ error: "Escolha uma senha diferente da senha provisória." });
        }

        const senhaHash = await bcrypt.hash(novaSenha, 12);
        await db.query(
            "UPDATE login SET senha = ?, mustChangePassword = 0, provisionalPasswordEncrypted = NULL, tokenVersion = tokenVersion + 1 WHERE idLogin = ?",
            [senhaHash, conta.idLogin]
        );
        await registrarLog({
            acao: "TROCA_SENHA_PRIMEIRO_ACESSO",
            entidade: "login",
            entidadeId: conta.idLogin,
            req,
            detalhes: { nome: conta.nome },
        });
        res.json({ message: "Senha alterada com sucesso. Entre novamente com a nova senha." });
    } catch (_err) {
        res.status(500).json({ error: "Erro ao alterar a senha." });
    }
};
