const fs = require('fs');
const path = require('path');

const services = [
  { issuer: 'service.backend', keyStore: '../backend/utils/keyStore' },
  { issuer: 'service.admin-backend', keyStore: '../platform/admin/backend/utils/keyStore' },
  { issuer: 'service.openmeteo', keyStore: '../services/openMeteo/utils/keyStore' },
  { issuer: 'service.nominatim', keyStore: '../services/nominatim/utils/keyStore' },
  { issuer: 'service.socketio', keyStore: '../services/socketio/utils/keyStore' }
];

async function run() {
  const jwks = {};

  for (const svc of services) {
    const ks = require(path.join(__dirname, svc.keyStore));
    await ks.generateOrLoadKeypairs();
    const jwk = await ks.getSigningPublicJwk();
    jwks[svc.issuer] = jwk;
  }

  const outDir = path.join(process.cwd(), 'config');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const outPath = path.join(outDir, 'service-jwks.json');
  fs.writeFileSync(outPath, JSON.stringify(jwks, null, 2));
  console.log(`Wrote ${outPath}`);
}

run().catch((err) => {
  console.error('Failed to generate service JWKs', err?.message || err);
  process.exit(1);
});
