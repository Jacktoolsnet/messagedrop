const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const express = require('express');
const { rateLimit } = require('express-rate-limit');

function loadPolicy() {
  const context = {
    module: { exports: {} }, process: { env: {} },
    require: () => ({ verifyServiceJwt(token, options) {
      assert.equal(options.audience, 'service.admin-backend');
      if (token !== 'verified-service-token') throw new Error('Invalid token');
      return { iss: 'service.geodata' };
    } })
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../middleware/service-log-rate-limit.js'), 'utf8'), context);
  return context.module.exports;
}

test('only verified service POSTs to log ingestion bypass the limit', () => {
  const { identifyServiceLogIngestion, skipServiceLogIngestion } = loadPolicy();
  for (const [method, url, token, expected] of [
    ['POST', '/info-log', 'verified-service-token', true],
    ['POST', '/warn-log/', 'verified-service-token', true],
    ['POST', '/error-log', 'verified-service-token', true],
    ['GET', '/info-log', 'verified-service-token', false],
    ['DELETE', '/info-log', 'verified-service-token', false],
    ['POST', '/user/login', 'verified-service-token', false],
    ['POST', '/info-log', 'invalid-token', false],
    ['POST', '/info-log', 'browser-token', false],
    ['POST', '/info-log', '', false]
  ]) {
    const req = { method, path: url, headers: { authorization: 'Bearer ' + token } };
    identifyServiceLogIngestion(req, {}, () => {});
    req.path = '/'; // Express mount-path trimming must not lose the verified result.
    assert.equal(skipServiceLogIngestion(req), expected);
  }
});

test('service burst does not consume browser quota; 429 does not stop subsequent requests', async () => {
  const { identifyServiceLogIngestion, skipServiceLogIngestion } = loadPolicy();
  const app = express();
  app.use(identifyServiceLogIngestion);
  app.use(rateLimit({ windowMs: 60000, limit: 2, skip: skipServiceLogIngestion }));
  app.use('/info-log', rateLimit({ windowMs: 60000, limit: 2, skip: skipServiceLogIngestion }));
  app.post('/info-log', (_req, res) => res.sendStatus(201));
  app.get('/jobs', (_req, res) => res.sendStatus(200));
  const server = await new Promise(resolve => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const sendLog = () => fetch(base + '/info-log', {
      method: 'POST', headers: { authorization: 'Bearer verified-service-token' }
    });
    for (let i = 0; i < 25; i++) assert.equal((await sendLog()).status, 201);
    assert.equal((await fetch(base + '/jobs')).status, 200);
    assert.equal((await fetch(base + '/jobs')).status, 200);
    assert.equal((await fetch(base + '/jobs')).status, 429);
    assert.equal((await sendLog()).status, 201);
    assert.equal((await fetch(base + '/jobs')).status, 429);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
