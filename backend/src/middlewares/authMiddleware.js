const jwt = require("jsonwebtoken");
const db = require("../config/db");
const { JWT_SECRET } = require("../config/authConfig");

module.exports = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Token não enviado" });

    const token = authHeader.split(" ")[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const [rows] = await db.query(
            "SELECT ativo, tokenVersion, mustChangePassword FROM login WHERE idLogin = ?",
            [decoded.idLogin]
        );
        const conta = rows[0];
        const versaoToken = Number(decoded.tokenVersion || 0);
        if (!conta || !Boolean(conta.ativo) || Number(conta.tokenVersion || 0) !== versaoToken) {
            return res.status(401).json({ error: "Token inválido ou conta inativa" });
        }

        const rotaTrocaSenha = req.originalUrl?.startsWith("/auth/primeiro-acesso/senha");
        if (Boolean(conta.mustChangePassword) && !rotaTrocaSenha) {
            return res.status(403).json({
                error: "É obrigatório alterar a senha provisória antes de acessar o sistema.",
                code: "PASSWORD_CHANGE_REQUIRED",
            });
        }

        req.usuario = decoded;
        next();
    } catch (_err) {
        return res.status(401).json({ error: "Token inválido" });
    }
};
