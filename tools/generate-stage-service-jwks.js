const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { createDecipheriv, scryptSync } = require('crypto');

const SERVICES = [
  { name: 'backend', issuer: 'service.backend', dir: 'backend' },
  { name: 'admin-backend', issuer: 'service.admin-backend', dir: 'admin-backend' },
  { name: 'openMeteo', issuer: 'service.openmeteo', dir: 'openMeteo' },
  { name: 'nominatim', issuer: 'service.nominatim', dir: 'nominatim' },
  { name: 'socketio', issuer: 'service.socketio', dir: 'socketio' },
  { name: 'viator', issuer: 'service.viator', dir: 'viator' }
];

function getArgValue(flag) {
  const idx = process.argv.indexOf(`--${flag}`);
  if (idx === -1 || idx + 1 >= process.argv.length) return null;
  return process.argv[idx + 1];
}

function getAesKey(password, salt) {
  return scryptSync(password, salt, 32);
}

function decryptData(buffer, password) {
  const salt = buffer.subarray(0, 16);
  const iv = buffer.subarray(16, 32);
  const tag = buffer.subarray(32, 48);
  const encrypted = buffer.subarray(48);
  const key = getAesKey(password, salt);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

function loadSigningPublicJwk(signingKeyPath, password, serviceName) {
  if (!fs.existsSync(signingKeyPath)) {
    throw new Error(`Missing signing key file: ${signingKeyPath}`);
  }
  try {
    const encData = fs.readFileSync(signingKeyPath);
    const decrypted = decryptData(encData, password);
    const jwkBundle = JSON.parse(decrypted.toString('utf8'));
    if (!jwkBundle?.publicKey) {
      throw new Error('publicKey missing');
    }
    return jwkBundle.publicKey;
  } catch (err) {
    throw new Error(`Failed to decrypt signing key for ${serviceName}: ${err?.message || err}`);
  }
}

function fileExists(filePath) {
  return fs.existsSync(filePath);
}

function readJsonFile(filePath) {
  if (!fileExists(filePath)) {
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return {};
  }
}

function createInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

function ask(rl, prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => resolve(answer));
  });
}

async function promptStage(rl) {
  const argStage = getArgValue('stage');
  if (argStage === 'q' || argStage === 'p') {
    return argStage;
  }
  while (true) {
    const answer = (await ask(rl, 'Stage to process (q/p): ')).trim().toLowerCase();
    if (answer === 'q' || answer === 'p') {
      return answer;
    }
    console.log('Please enter "q" or "p".');
  }
}

async function promptYesNo(rl, prompt) {
  const answer = (await ask(rl, prompt)).trim().toLowerCase();
  return answer === 'y' || answer === 'yes';
}

async function promptPassword(rl, prompt) {
  while (true) {
    const answer = await ask(rl, prompt);
    if (answer) return answer;
    console.log('Password cannot be empty.');
  }
}

async function run() {
  const rl = createInterface();
  try {
    const stage = await promptStage(rl);
    const stageDir = path.join(process.cwd(), 'keys', stage);
    if (!fs.existsSync(stageDir)) {
      throw new Error(`Stage keys directory not found: ${stageDir}`);
    }

    const availableServices = SERVICES.filter((svc) => {
      const signingKeyPath = path.join(stageDir, svc.dir, 'signing.key.enc');
      return fileExists(signingKeyPath);
    });
    const skippedServices = SERVICES.filter((svc) => !availableServices.includes(svc));

    if (availableServices.length === 0) {
      throw new Error(`No signing.key.enc files found in ${stageDir}`);
    }

    if (skippedServices.length > 0) {
      console.log(
        `Skipping services without signing.key.enc: ${skippedServices.map((svc) => svc.name).join(', ')}`
      );
    }

    const useSame = await promptYesNo(
      rl,
      'Use same SIGNING_KEY_PASSWORD for all services? (y/N): '
    );
    const passwords = new Map();
    if (useSame) {
      const password = await promptPassword(rl, 'SIGNING_KEY_PASSWORD: ');
      for (const svc of availableServices) {
        passwords.set(svc.name, password);
      }
    } else {
      for (const svc of availableServices) {
        const password = await promptPassword(
          rl,
          `SIGNING_KEY_PASSWORD for ${svc.name}: `
        );
        passwords.set(svc.name, password);
      }
    }

    const jwks = {};
    for (const svc of availableServices) {
      const keyDir = path.join(stageDir, svc.dir);
      const signingKeyPath = path.join(keyDir, 'signing.key.enc');
      const password = passwords.get(svc.name);
      jwks[svc.issuer] = loadSigningPublicJwk(signingKeyPath, password, svc.name);
    }

    for (const svc of availableServices) {
      const outDir = path.join(stageDir, svc.dir);
      if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
      }
      const outPath = path.join(outDir, 'service-jwks.json');
      const existing = readJsonFile(outPath);
      const merged = { ...existing, ...jwks };
      fs.writeFileSync(outPath, JSON.stringify(merged, null, 2));
      console.log(`Wrote ${outPath}`);
    }
  } finally {
    rl.close();
  }
}

run().catch((err) => {
  console.error('Failed to generate stage service JWKs', err?.message || err);
  process.exit(1);
});
