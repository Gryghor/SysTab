function carregarJwtSecret() {
    const secret = String(process.env.JWT_SECRET || "").trim();

    if (!secret) {
        if (process.env.NODE_ENV === "test") {
            return "systab-test-secret-isolado-com-mais-de-32-caracteres";
        }
        throw new Error("JWT_SECRET não configurado. Defina um segredo forte antes de iniciar o backend.");
    }

    if (secret.length < 32) {
        throw new Error("JWT_SECRET deve possuir pelo menos 32 caracteres.");
    }

    return secret;
}

module.exports = { JWT_SECRET: carregarJwtSecret() };
