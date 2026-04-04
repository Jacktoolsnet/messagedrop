const fs = require('fs');
const path = require('path');

const services = [
  { issuer: 'service.backend', keyStore: '../backend/utils/keyStore' },
  { issuer: 'service.admin-backend', keyStore: '../platform/admin/backend/utils/keyStore' },
  { issuer: 'service.openmeteo', keyStore: '../services/openMeteo/utils/keyStore' },
  { issuer: 'service.nominatim', keyStore: '../services/nominatim/utils/keyStore' },
  { issuer: 'service.socketio', keyStore: '../services/socketio/utils/keyStore' },
  { issuer: 'service.viator', keyStore: '../services/viator/utils/keyStore' },
  { issuer: 'service.sticker', keyStore: '../services/sticker/utils/keyStore' }
];

function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return {};
  }
}

function collectExistingJwks(outputDirs) {
  const merged = {};
  for (const dir of outputDirs) {
    const outPath = path.join(dir, 'service-jwks.json');
    Object.assign(merged, readJsonFile(outPath));
  }
  return merged;
}

async function run() {
  const generatedJwks = {};

  const outDir = path.join(process.cwd(), 'config');
  const outputDirs = [
    outDir,
    path.join(process.cwd(), 'backend', 'config'),
    path.join(process.cwd(), 'platform', 'admin', 'backend', 'config'),
    path.join(process.cwd(), 'services', 'openMeteo', 'config'),
    path.join(process.cwd(), 'services', 'nominatim', 'config'),
    path.join(process.cwd(), 'services', 'socketio', 'config'),
    path.join(process.cwd(), 'services', 'viator', 'config'),
    path.join(process.cwd(), 'services', 'sticker', 'config')
  ];

  for (const svc of services) {
    const ks = require(path.join(__dirname, svc.keyStore));
    await ks.generateOrLoadKeypairs();
    const jwk = await ks.getSigningPublicJwk();
    generatedJwks[svc.issuer] = jwk;
  }

  const existingJwks = collectExistingJwks(outputDirs);
  const jwks = { ...existingJwks, ...generatedJwks };

  for (const dir of outputDirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const outPath = path.join(dir, 'service-jwks.json');
    fs.writeFileSync(outPath, JSON.stringify(jwks, null, 2));
    console.log(`Wrote ${outPath}`);
  }
}

run().catch((err) => {
  console.error('Failed to generate service JWKs', err?.message || err);
  process.exit(1);
});
