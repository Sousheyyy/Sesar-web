import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;

function getKey(): Buffer {
    const key = process.env.BANK_DATA_ENCRYPTION_KEY;
    if (!key || key.length !== 64) {
        throw new Error("BANK_DATA_ENCRYPTION_KEY must be a 64-char hex string");
    }
    return Buffer.from(key, "hex");
}

/** Encrypts plaintext into format: iv:authTag:ciphertext (all hex) */
export function encryptBankDetails(plaintext: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);

    let encrypted = cipher.update(plaintext, "utf8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag();

    return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/** Decrypts from format: iv:authTag:ciphertext (all hex) */
export function decryptBankDetails(encrypted: string): string {
    const [ivHex, authTagHex, ciphertext] = encrypted.split(":");
    if (!ivHex || !authTagHex || !ciphertext) {
        throw new Error("Invalid encrypted data format");
    }

    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
}

/** Safely decrypt bankDetails — returns original string if not encrypted or on error */
export function safeDecryptBankDetails(value: string | null): string | null {
    if (!value) return null;
    // Already plaintext JSON (legacy unencrypted data)
    if (value.startsWith("{") || value.startsWith("[")) return value;
    try {
        return decryptBankDetails(value);
    } catch {
        return value;
    }
}
