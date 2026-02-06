/**
 * Token Encryption Utilities
 * For secure storage of InsightIQ access/refresh tokens
 */

import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '';
const IV_LENGTH = 16;
const ALGORITHM = 'aes-256-cbc';

/**
 * Validate that the encryption key is properly configured
 * Call this before any encryption/decryption operations
 */
function validateEncryptionKey(): void {
    if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
        throw new Error(
            'ENCRYPTION_KEY must be a 64-character hex string (32 bytes). ' +
            'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
        );
    }
}

/**
 * Check if encryption is properly configured (without throwing)
 */
export function isEncryptionConfigured(): boolean {
    return ENCRYPTION_KEY.length === 64;
}

/**
 * Encrypt a token for secure database storage
 */
export function encryptToken(token: string): string {
    validateEncryptionKey();
    
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(
        ALGORITHM,
        Buffer.from(ENCRYPTION_KEY, 'hex'),
        iv
    );

    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Return IV + encrypted data (separated by colon)
    return iv.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt a token from database storage
 */
export function decryptToken(encryptedToken: string): string {
    validateEncryptionKey();
    
    const parts = encryptedToken.split(':');

    if (parts.length !== 2) {
        throw new Error('Invalid encrypted token format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];

    const decipher = crypto.createDecipheriv(
        ALGORITHM,
        Buffer.from(ENCRYPTION_KEY, 'hex'),
        iv
    );

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}

/**
 * Verify encryption is working correctly
 * Use in tests or on startup
 */
export function testEncryption(): boolean {
    try {
        if (!isEncryptionConfigured()) {
            console.warn('Encryption not configured - ENCRYPTION_KEY is missing or invalid');
            return false;
        }
        
        const testToken = 'test-token-' + Date.now();
        const encrypted = encryptToken(testToken);
        const decrypted = decryptToken(encrypted);
        return testToken === decrypted;
    } catch (error) {
        console.error('Encryption test failed:', error);
        return false;
    }
}
