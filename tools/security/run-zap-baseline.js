#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    let value = rawValue.trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function parseArgs(argv) {
  const result = {
    target: null,
    allLocal: false,
    name: null,
    localZap: process.env.ZAP_BASELINE_COMMAND || 'zap-baseline.py',
    dockerImage: process.env.ZAP_DOCKER_IMAGE || 'ghcr.io/zaproxy/zaproxy:stable',
    network: process.env.ZAP_DOCKER_NETWORK || 'host'
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--target') {
      result.target = argv[++i];
    } else if (arg === '--all-local') {
      result.allLocal = true;
    } else if (arg === '--name') {
      result.name = argv[++i];
    } else if (arg === '--image') {
      result.dockerImage = argv[++i];
    } else if (arg === '--network') {
      result.network = argv[++i];
    } else if (arg === '--local-zap') {
      result.localZap = argv[++i];
    }
  }
  return result;
}

function isExecutable(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function findExecutable(command) {
  if (!command) {
    return null;
  }
  if (command.includes('/') || command.includes('\\')) {
    return isExecutable(command) ? command : null;
  }
  const pathEntries = String(process.env.PATH || '').split(path.delimiter).filter(Boolean);
  for (const entry of pathEntries) {
    const candidate = path.join(entry, command);
    if (isExecutable(candidate)) {
      return candidate;
    }
  }
  return null;
}

const repoRoot = path.resolve(__dirname, '..', '..');
loadDotEnv(path.join(repoRoot, '.env'));

const options = parseArgs(process.argv.slice(2));
const reportsDir = path.join(repoRoot, 'tools', 'security', 'reports');
fs.mkdirSync(reportsDir, { recursive: true });
const dockerExecutable = findExecutable('docker');
const localZapBaselineExecutable = findExecutable(options.localZap);

function defaultLocalTargets() {
  return [
    { name: 'backend', target: `http://127.0.0.1:${process.env.PORT || 3000}` },
    { name: 'admin-backend', target: `http://127.0.0.1:${process.env.ADMIN_PORT || 3100}` },
    { name: 'openmeteo', target: `http://127.0.0.1:${process.env.OPENMETEO_PORT || 3200}` },
    { name: 'nominatim', target: `http://127.0.0.1:${process.env.NOMINATIM_PORT || 3300}` },
    { name: 'wikipedia', target: `http://127.0.0.1:${process.env.WIKIPEDIA_PORT || 3700}` },
    { name: 'socketio', target: `http://127.0.0.1:${process.env.SOCKETIO_PORT || 3400}` },
    { name: 'viator', target: `http://127.0.0.1:${process.env.VIATOR_PORT || 3500}` },
    { name: 'sticker', target: `http://127.0.0.1:${process.env.STICKER_PORT || 3600}` }
  ];
}

function reportNameFor(target, explicitName) {
  return (explicitName || target.replace(/^https?:\/\//, '').replace(/[^a-z0-9_.-]+/gi, '_')).replace(/_+$/, '');
}

function buildTargetList() {
  if (options.allLocal) {
    return defaultLocalTargets();
  }
  const envTargets = process.env.ZAP_TARGETS || process.env.SECURITY_ZAP_TARGETS;
  if (envTargets) {
    return envTargets
      .split(',')
      .map((target) => target.trim())
      .filter(Boolean)
      .map((target) => ({ target, name: reportNameFor(target) }));
  }
  const defaultTarget = `http://127.0.0.1:${process.env.PORT || 3000}`;
  const target = (options.target || process.env.ZAP_TARGET || defaultTarget).replace(/\/+$/, '');
  return [{ target, name: reportNameFor(target, options.name) }];
}

function runZapScan({ target, name }) {
  const normalizedTarget = target.replace(/\/+$/, '');
  const reportName = reportNameFor(normalizedTarget, name);
  const htmlReport = `${reportName}.zap.html`;
  const jsonReport = `${reportName}.zap.json`;

  console.log('Running OWASP ZAP baseline scan');
  console.log(`Target: ${normalizedTarget}`);
  console.log(`Reports: ${path.join(reportsDir, htmlReport)}, ${path.join(reportsDir, jsonReport)}`);
  console.log('');

  let result;
  if (dockerExecutable) {
    const dockerArgs = [
      'run',
      '--rm',
      '--network',
      options.network,
      '-v',
      `${reportsDir}:/zap/wrk:rw`,
      options.dockerImage,
      'zap-baseline.py',
      '-t',
      normalizedTarget,
      '-r',
      htmlReport,
      '-J',
      jsonReport
    ];
    result = spawnSync(dockerExecutable, dockerArgs, {
      stdio: 'inherit'
    });
  } else if (localZapBaselineExecutable) {
    const localZapArgs = [
      '-t',
      normalizedTarget,
      '-r',
      htmlReport,
      '-J',
      jsonReport
    ];
    result = spawnSync(localZapBaselineExecutable, localZapArgs, {
      cwd: reportsDir,
      stdio: 'inherit'
    });
  } else {
    console.error('OWASP ZAP baseline scanner is not available.');
    console.error('');
    console.error('Install one of these options:');
    console.error('  1. Docker, then rerun this launch config.');
    console.error('  2. OWASP ZAP locally and make zap-baseline.py available on PATH.');
    console.error('  3. Set ZAP_BASELINE_COMMAND=/path/to/zap-baseline.py in your environment.');
    console.error('');
    console.error('Protected-route smoke tests do not need Docker/ZAP; you can run that launch config immediately.');
    return 1;
  }

  if (result.error) {
    console.error('');
    console.error(`Failed to start ZAP baseline scanner: ${result.error.message}`);
    return 1;
  }

  // zap-baseline.py uses non-zero exit codes for WARN/FAIL findings.
  // Keep the same exit code so VS Code visibly reports findings.
  return result.status ?? 1;
}

const targets = buildTargetList();
let exitCode = 0;
for (const entry of targets) {
  const scanExitCode = runZapScan(entry);
  if (scanExitCode !== 0) {
    exitCode = scanExitCode;
  }
}
process.exit(exitCode);
