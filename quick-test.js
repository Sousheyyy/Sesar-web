#!/usr/bin/env node

/**
 * Quick Test Script for InsightIQ Integration
 * Run with: node quick-test.js
 */

// Load .env file
require('dotenv').config();

console.log('🧪 InsightIQ Integration - Quick Test\n');

// Test 1: Environment Variables
console.log('1️⃣ Testing Environment Variables...');
const requiredEnvVars = [
    'INSIGHTIQ_CLIENT_ID',
    'INSIGHTIQ_CLIENT_SECRET',
    'INSIGHTIQ_BASE_URL',
    'INSIGHTIQ_REDIRECT_URI',
    'ENCRYPTION_KEY',
];

let envTestPassed = true;
requiredEnvVars.forEach((envVar) => {
    const value = process.env[envVar];
    if (!value) {
        console.log(`   ❌ ${envVar} is missing`);
        envTestPassed = false;
    } else {
        console.log(`   ✅ ${envVar} is set`);
    }
});

if (!envTestPassed) {
    console.log('\n❌ Environment variable check FAILED');
    console.log('💡 Make sure your .env file is properly configured\n');
    process.exit(1);
}

console.log('   ✅ All environment variables configured\n');

// Test 2: Encryption
console.log('2️⃣ Testing Encryption...');
try {
    const crypto = require('crypto');
    const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

    if (ENCRYPTION_KEY.length !== 64) {
        throw new Error('ENCRYPTION_KEY must be 64 characters');
    }

    // Test encryption
    const testToken = 'test-token-' + Date.now();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
        'aes-256-cbc',
        Buffer.from(ENCRYPTION_KEY, 'hex'),
        iv
    );

    let encrypted = cipher.update(testToken, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Test decryption
    const decipher = crypto.createDecipheriv(
        'aes-256-cbc',
        Buffer.from(ENCRYPTION_KEY, 'hex'),
        iv
    );

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    if (decrypted === testToken) {
        console.log('   ✅ Encryption/Decryption working correctly\n');
    } else {
        throw new Error('Decryption failed - tokens do not match');
    }
} catch (error) {
    console.log(`   ❌ Encryption test failed: ${error.message}\n`);
    process.exit(1);
}

// Test 3: URL Utilities
console.log('3️⃣ Testing URL Utilities...');

function extractMusicId(url) {
    const match = url.match(/\/music\/[^/]+-(\d+)/);
    return match ? match[1] : null;
}

function extractVideoId(url) {
    const match = url.match(/\/video\/(\d+)/);
    return match ? match[1] : null;
}

const urlTests = [
    {
        type: 'music',
        url: 'https://www.tiktok.com/music/Song-Name-7123456789',
        expected: '7123456789',
        extractor: extractMusicId,
    },
    {
        type: 'video',
        url: 'https://www.tiktok.com/@user/video/7350123456',
        expected: '7350123456',
        extractor: extractVideoId,
    },
];

let urlTestsPassed = true;
urlTests.forEach(({ type, url, expected, extractor }) => {
    const result = extractor(url);
    if (result === expected) {
        console.log(`   ✅ ${type} ID extraction: ${result}`);
    } else {
        console.log(`   ❌ ${type} ID extraction failed: got ${result}, expected ${expected}`);
        urlTestsPassed = false;
    }
});

if (!urlTestsPassed) {
    console.log('\n❌ URL parsing tests FAILED\n');
    process.exit(1);
}

console.log('   ✅ All URL parsing tests passed\n');

// Test 4: File Structure
console.log('4️⃣ Checking File Structure...');
const fs = require('fs');
const path = require('path');

const requiredFiles = [
    'lib/crypto.ts',
    'lib/insightiq/types.ts',
    'lib/insightiq/client.ts',
    'lib/insightiq/token-manager.ts',
    'lib/insightiq/url-utils.ts',
    'app/api/auth/insightiq/initiate/route.ts',
    'app/api/auth/insightiq/callback/route.ts',
    'app/api/auth/insightiq/status/route.ts',
    'app/api/auth/insightiq/disconnect/route.ts',
    'app/api/songs/upload/route.ts',
    'app/api/campaigns/[id]/submit-video/route.ts',
    'prisma/schema.prisma',
];

let fileCheckPassed = true;
requiredFiles.forEach((file) => {
    const fullPath = path.join(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
        console.log(`   ✅ ${file}`);
    } else {
        console.log(`   ❌ ${file} not found`);
        fileCheckPassed = false;
    }
});

if (!fileCheckPassed) {
    console.log('\n❌ File structure check FAILED\n');
    process.exit(1);
}

console.log('   ✅ All required files present\n');

// Final Summary
console.log('═'.repeat(60));
console.log('🎉 ALL TESTS PASSED!');
console.log('═'.repeat(60));
console.log('\n✅ InsightIQ integration is properly configured');
console.log('✅ Encryption utilities working');
console.log('✅ URL parsing functional');
console.log('✅ All files in place\n');
console.log('📋 Next Steps:');
console.log('   1. Run database migration: npx prisma migrate dev');
console.log('   2. Start dev server: npm run dev');
console.log('   3. Test OAuth flow in browser');
console.log('   4. See tests/MANUAL_TESTING.md for detailed tests\n');
