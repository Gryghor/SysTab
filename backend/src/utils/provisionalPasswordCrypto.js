const { createCipheriv, createDecipheriv, createHash, randomBytes } = require("crypto");
const { JWT_SECRET } = require("../config/authConfig");

function encryptionKey() {
    const secret = process.env.PROVISIONAL_PASSWORD_SECRET || JWT_SECRET;
    return createHash("sha256").update(secret).digest();
}

exports.encryptProvisionalPassword = (password) => {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(password, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`;
};

exports.decryptProvisionalPassword = (payload) => {
    const [ivBase64, tagBase64, encryptedBase64] = String(payload || "").split(".");
    if (!ivBase64 || !tagBase64 || !encryptedBase64) {
        throw new Error("Credencial provisória inválida.");
    }
    const decipher = createDecipheriv(
        "aes-256-gcm",
        encryptionKey(),
        Buffer.from(ivBase64, "base64")
    );
    decipher.setAuthTag(Buffer.from(tagBase64, "base64"));
    return Buffer.concat([
        decipher.update(Buffer.from(encryptedBase64, "base64")),
        decipher.final(),
    ]).toString("utf8");
};
