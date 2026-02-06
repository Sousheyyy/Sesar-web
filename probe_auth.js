const https = require('https');

const clientId = '811754ac-0840-45da-87ab-635f95313383';
const clientSecret = '5423df55-812b-419a-8dd8-a30f80b00359';

// Targets
const targets = [
    { host: 'api.sandbox.insightiq.ai', prefix: '' },
    { host: 'api.insightiq.ai', prefix: '' },
    { host: 'api.insightiq.ai', prefix: '/api' },
];

const paths = [
    '/v1/token',
    '/v1/connect/initiate',
];

const authBasic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

const configs = [
    // Previous standard attempts
    { name: 'Basic', headers: { 'Authorization': `Basic ${authBasic}` } },
    { name: 'Bearer Secret', headers: { 'Authorization': `Bearer ${clientSecret}` } },

    // Raw Authorization
    { name: 'Raw Secret', headers: { 'Authorization': clientSecret } },
    { name: 'Raw ID', headers: { 'Authorization': clientId } },
    { name: 'Token Scheme', headers: { 'Authorization': `Token ${clientSecret}` } },

    // Custom Headers
    { name: 'InsightIQ-API-Key', headers: { 'InsightIQ-API-Key': clientSecret } },
    { name: 'X-InsightIQ-Key', headers: { 'X-InsightIQ-Key': clientSecret } },
    { name: 'Application-Id', headers: { 'Application-Id': clientId, 'Application-Key': clientSecret } },
    { name: 'Client-ID Header', headers: { 'Client-ID': clientId, 'Client-Secret': clientSecret } },

    // JSON Body Creds (Headerless)
    { name: 'Body Creds', headers: {}, body: { client_id: clientId, client_secret: clientSecret } }
];

async function probe(host, path, config) {
    return new Promise((resolve) => {
        const options = {
            hostname: host,
            path: path,
            method: 'POST',
            headers: {
                ...config.headers,
                'Content-Type': 'application/json',
                'User-Agent': 'InsightIQ-Test/1.0'
            },
            timeout: 5000
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                // Ignore standard IAM errors to reduce noise
                const isIamError = res.statusCode === 403 &&
                    (data.includes('Missing Authentication Token') || data.includes('Credential') || data.includes('signature'));

                if (!isIamError && res.statusCode !== 404) {
                    console.log(`[${res.statusCode}] https://${host}${path} (${config.name})`);
                    if (res.statusCode === 200 || res.statusCode === 201 || res.statusCode === 401) {
                        console.log('  -> RESPONSE:', data.substring(0, 300));
                    }
                }
                resolve();
            });
        });

        req.on('error', (e) => {
            // console.error(`ERR ${host}: ${e.message}`);
            resolve();
        });

        req.on('timeout', () => {
            req.destroy();
            resolve();
        });

        if (config.body) {
            req.write(JSON.stringify({ ...config.body, platform: 'tiktok', user_id: 'test', redirect_uri: 'http://localhost' }));
        } else {
            req.write(JSON.stringify({ platform: 'tiktok', user_id: 'test', redirect_uri: 'http://localhost' }));
        }

        req.end();
    });
}

async function run() {
    console.log(`Starting Exhaustive Probe...`);
    for (const target of targets) {
        for (const path of paths) {
            for (const config of configs) {
                await probe(target.host, target.prefix + path, config);
            }
        }
    }
    console.log('Probe Complete.');
}

run();
