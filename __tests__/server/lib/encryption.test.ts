import { encryptBankDetails, decryptBankDetails, safeDecryptBankDetails } from "../../../server/lib/encryption";

// Set test encryption key (64-char hex = 32 bytes)
const TEST_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
process.env.BANK_DATA_ENCRYPTION_KEY = TEST_KEY;

describe("encryption", () => {
    const testData = JSON.stringify({ iban: "TR123456789", accountHolder: "Test User" });

    describe("encryptBankDetails", () => {
        it("produces encrypted output different from input", () => {
            const encrypted = encryptBankDetails(testData);
            expect(encrypted).not.toBe(testData);
        });

        it("produces output in iv:authTag:ciphertext format", () => {
            const encrypted = encryptBankDetails(testData);
            const parts = encrypted.split(":");
            expect(parts).toHaveLength(3);
            // IV is 16 bytes = 32 hex chars
            expect(parts[0]).toHaveLength(32);
            // Auth tag is 16 bytes = 32 hex chars
            expect(parts[1]).toHaveLength(32);
            // Ciphertext is non-empty
            expect(parts[2].length).toBeGreaterThan(0);
        });

        it("produces different output each time (random IV)", () => {
            const enc1 = encryptBankDetails(testData);
            const enc2 = encryptBankDetails(testData);
            expect(enc1).not.toBe(enc2);
        });
    });

    describe("decryptBankDetails", () => {
        it("round-trips correctly", () => {
            const encrypted = encryptBankDetails(testData);
            const decrypted = decryptBankDetails(encrypted);
            expect(decrypted).toBe(testData);
        });

        it("preserves JSON structure after round-trip", () => {
            const encrypted = encryptBankDetails(testData);
            const decrypted = decryptBankDetails(encrypted);
            const parsed = JSON.parse(decrypted);
            expect(parsed.iban).toBe("TR123456789");
            expect(parsed.accountHolder).toBe("Test User");
        });

        it("throws on invalid format", () => {
            expect(() => decryptBankDetails("not-encrypted")).toThrow("Invalid encrypted data format");
        });

        it("throws on tampered ciphertext", () => {
            const encrypted = encryptBankDetails(testData);
            const parts = encrypted.split(":");
            // Tamper with ciphertext
            parts[2] = "ff" + parts[2].slice(2);
            expect(() => decryptBankDetails(parts.join(":"))).toThrow();
        });
    });

    describe("safeDecryptBankDetails", () => {
        it("returns null for null input", () => {
            expect(safeDecryptBankDetails(null)).toBeNull();
        });

        it("returns plaintext JSON unchanged (legacy data)", () => {
            const json = '{"iban":"TR123","name":"User"}';
            expect(safeDecryptBankDetails(json)).toBe(json);
        });

        it("decrypts encrypted data correctly", () => {
            const encrypted = encryptBankDetails(testData);
            const result = safeDecryptBankDetails(encrypted);
            expect(result).toBe(testData);
        });

        it("returns original value on decryption error", () => {
            // Non-JSON, non-encrypted string that looks like encrypted but isn't valid
            const badData = "abc:def:ghi";
            const result = safeDecryptBankDetails(badData);
            expect(result).toBe(badData);
        });
    });
});
