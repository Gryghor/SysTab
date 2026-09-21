const db = require("../config/db");
const { registrarLog } = require("../utils/logger");

const CHAVE_CPF_OBRIGATORIO = "cpf_obrigatorio";
const VALOR_PADRAO_CPF_OBRIGATORIO = true;

function valorBooleano(valor, padrao = VALOR_PADRAO_CPF_OBRIGATORIO) {
    if (valor === undefined || valor === null) return padrao;
    return ["1", "true", "sim", "on"].includes(String(valor).toLowerCase());
}

async function lerCpfObrigatorio() {
    try {
        const [rows] = await db.query(
            "SELECT valor FROM configuracoes WHERE chave = ?",
            [CHAVE_CPF_OBRIGATORIO]
        );
        return valorBooleano(rows[0]?.valor);
    } catch (_err) {
        // Mantém a regra atual enquanto a migration ainda não foi aplicada.
        return VALOR_PADRAO_CPF_OBRIGATORIO;
    }
}

exports.obterConfiguracoes = async (_req, res) => {
    try {
        res.json({ cpfObrigatorio: await lerCpfObrigatorio() });
    } catch (_err) {
        res.status(500).json({ error: "Erro ao carregar configurações." });
    }
};

exports.atualizarCpfObrigatorio = async (req, res) => {
    const { obrigatorio } = req.body || {};
    if (typeof obrigatorio !== "boolean") {
        return res.status(400).json({ error: "Informe uma configuração válida." });
    }

    try {
        await db.query(
            `INSERT INTO configuracoes (chave, valor)
             VALUES (?, ?)
             ON DUPLICATE KEY UPDATE valor = VALUES(valor), atualizadoEm = CURRENT_TIMESTAMP`,
            [CHAVE_CPF_OBRIGATORIO, obrigatorio ? "1" : "0"]
        );

        await registrarLog({
            acao: "ALTERACAO_CONFIGURACAO",
            entidade: "configuracao",
            req,
            detalhes: { chave: CHAVE_CPF_OBRIGATORIO, valor: obrigatorio },
        });

        res.json({ cpfObrigatorio: obrigatorio, message: "Configuração atualizada com sucesso." });
    } catch (_err) {
        res.status(500).json({ error: "Erro ao atualizar configuração." });
    }
};

exports.lerCpfObrigatorio = lerCpfObrigatorio;
