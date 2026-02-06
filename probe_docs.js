const https = require('https');

const domains = [
    'api.sandbox.insightiq.ai',
    'api.insightiq.ai'
];

const paths = [
    '/docs',
    '/api-docs',
    '/swagger',
    '/swagger.json',
    '/openapi.json',
    '/v1/docs',
    '/v1/swagger.json',
    '/health',
    '/status'
];

async function probe(domain, path) {
    return new Promise((resolve) => {
        const options = {
            hostname: domain,
            path: path,
            method: 'GET',
            timeout: 3000
        };

        const req = https.request(options, (res) => {
            console.log(`[${res.statusCode}] https://${domain}${path}`);
            if (res.statusCode === 200) {
                let data = '';
                res.on('data', c => data += c);
                res.on('end', () => {
                    // console.log(data.substring(0, 200)); 
                    resolve(true);
                });
            } else {
                resolve(false);
            }
        });

        req.on('error', (e) => {
            console.log(`[ERR] https://${domain}${path} - ${e.message}`);
            resolve(false);
        });

        req.on('timeout', () => {
            req.destroy();
            console.log(`[TIMEOUT] https://${domain}${path}`);
            resolve(false);
        });

        req.end();
    });
}

async function run() {
    console.log('Probing for docs...');
    for (const d of domains) {
        for (const p of paths) {
            await probe(d, p);
        }
    }
}

run();
