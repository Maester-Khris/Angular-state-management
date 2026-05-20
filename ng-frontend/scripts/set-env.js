const fs = require('fs');

const prodEnvPath = './src/environments/environment.prod.ts';

let content = fs.readFileSync(prodEnvPath, 'utf8');

content = content
    .replace('$NODE_SERVICE_URL', process.env.NODE_SERVICE_URL || '')
    .replace('$GOOGLE_CLIENT_ID', process.env.GOOGLE_CLIENT_ID || '');

fs.writeFileSync(prodEnvPath, content);

console.log('environment.prod.ts injected:');
console.log('  NODE_SERVICE_URL:', process.env.NODE_SERVICE_URL);
console.log('  GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? '***set***' : 'MISSING');