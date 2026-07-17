// Traduz erros de banco (MySQL/MariaDB) em mensagens específicas para o usuário final,
// em vez de deixar cada controller devolver um "Erro ao salvar." genérico.
// `duplicateFields` mapeia o nome da chave/índice do MySQL (ex: "cpf", "idUser") para
// a mensagem completa a exibir quando aquele índice único é violado.
function mapDbError(err, { duplicateFields = {}, referencedMessage, fallback } = {}) {
    if (err && err.code === "ER_DUP_ENTRY") {
        const msg = err.sqlMessage || "";
        for (const [key, fullMessage] of Object.entries(duplicateFields)) {
            if (msg.includes(`'${key}'`)) return fullMessage;
        }
        return "Já existe um registro com esses dados.";
    }
    if (err && (err.code === "ER_ROW_IS_REFERENCED_2" || err.code === "ER_ROW_IS_REFERENCED")) {
        return referencedMessage || "Não é possível excluir: há registros vinculados a este item.";
    }
    return fallback || "Erro interno ao processar a solicitação.";
}

module.exports = { mapDbError };
