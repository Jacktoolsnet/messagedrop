const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

function load(file, mocks = {}, env = {}, extra = '') {
  const context = {
    require(name) {
      if (name in mocks) return mocks[name];
      throw new Error('Unexpected dependency: ' + name);
    },
    process: { env }, module: { exports: {} }, Date, console,
    setTimeout: fn => { fn(); },
    setInterval: () => ({ unref() {} })
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8') + extra, context);
  return context.module.exports;
}

const env = { ADMIN_ROOT_EMAIL: 'root@example.com', ADMIN_NOTIFICATION_EMAIL: 'alerts@example.com' };
test('admin alerts use configured recipient, with root fallback', async () => {
  for (const config of [env, { ADMIN_ROOT_EMAIL: env.ADMIN_ROOT_EMAIL }]) {
    let payload;
    const { sendAdminNotification } = load('utils/adminNotification.js', {
      './mailer': { sendMail: async p => { payload = p; return { success: true }; } }
    }, config);
    assert.equal((await sendAdminNotification({ title: 'Test', body: 'Body' })).success, true);
    assert.equal(payload.to, config.ADMIN_NOTIFICATION_EMAIL || config.ADMIN_ROOT_EMAIL);
  }
});

test('missing recipient prevents sending', async () => {
  const { sendAdminNotification } = load('utils/adminNotification.js', {
    './mailer': { sendMail: () => assert.fail('must not send') }
  });
  assert.equal((await sendAdminNotification({ title: 'Test', body: 'Body' })).reason, 'invalid_recipient');
});

test('transient errors retry at most three times; permanent failures do not retry', async () => {
  for (const [result, expected] of [
    [{ success: false, error: { responseCode: 451 } }, 3],
    [{ success: false, error: { responseCode: 550 } }, 1],
    [{ success: false, reason: 'not_configured' }, 1]
  ]) {
    let calls = 0;
    const { sendAdminNotification } = load('utils/adminNotification.js', {
      './mailer': { sendMail: async () => { calls++; return result; } }
    }, env);
    assert.equal((await sendAdminNotification({ title: 'Test', body: 'Body' })).success, false);
    assert.equal(calls, expected);
  }
});

test('login and PoW alerts are throttled independently; other alerts are not', async () => {
  let calls = 0;
  const { sendAdminNotification } = load('utils/adminNotification.js', {
    './mailer': { sendMail: async () => { calls++; return { success: true }; } }
  }, env);
  for (const throttleKey of ['login-failure', 'pow-enabled']) {
    assert.equal((await sendAdminNotification({ title: 'Test', body: 'Body', throttleKey })).success, true);
    assert.equal((await sendAdminNotification({ title: 'Test', body: 'Body', throttleKey })).suppressed, true);
  }
  await sendAdminNotification({ title: 'Signal', body: 'Body' });
  await sendAdminNotification({ title: 'Signal', body: 'Body' });
  assert.equal(calls, 4);
});

test('mailer returns consistent failure results and detects rejected recipients', async () => {
  const config = { MAIL_HOST: 'smtp.example.com', MAIL_PORT: '465', MAIL_USER: 'user', MAIL_PASSWORD: 'secret' };
  for (const [info, success] of [
    [{ accepted: ['a@example.com'], rejected: [] }, true],
    [{ accepted: [], rejected: ['a@example.com'] }, false]
  ]) {
    const { sendMail } = load('utils/mailer.js', {
      nodemailer: { createTransport: () => ({ once() {}, sendMail: async () => info }) }
    }, config);
    assert.equal((await sendMail({ to: 'a@example.com', subject: 'Test', text: 'Body' })).success, success);
    assert.equal((await sendMail({})).reason, 'invalid_payload');
  }
  const { sendMail } = load('utils/mailer.js', { nodemailer: {} });
  assert.equal((await sendMail({ to: 'a@example.com', subject: 'Test', text: 'Body' })).reason, 'not_configured');
});

function loadUser(sendMail, config = {}, otpTable = {}) {
  const noop = () => {};
  const mocks = {
    express: { Router: () => ({ post: noop, get: noop, patch: noop, delete: noop, put: noop, use: noop }) },
    jsonwebtoken: {}, bcrypt: {}, crypto, axios: {},
    'express-rate-limit': { rateLimit: noop, ipKeyGenerator: noop },
    '../middleware/security': { requireRole: noop },
    '../middleware/api-error': {},
    '../utils/mailer': { sendMail },
    '../utils/adminNotification': { sendAdminNotification: () => assert.fail('OTP must not send admin alert') },
    '../utils/serviceJwt': {}, '../utils/adminLogForwarder': {}
  };
  for (const name of ['tableUser', 'tableLoginOtp', 'tableDsaSignal', 'tableDsaNotice', 'tableDsaDecision', 'tableDsaAuditLog']) {
    mocks['../db/' + name] = name === 'tableLoginOtp' ? otpTable : {};
  }
  return load('routes/user.js', mocks, {
    MAIL_HOST: 'smtp.example.com', MAIL_PORT: '465', MAIL_USER: 'user', MAIL_PASSWORD: 'secret', ...config
  }, '\nmodule.exports = { sendOtp, createChallenge };');
}

test('OTP goes only to user email and fails closed on mail failure or missing email', async () => {
  let payload;
  const { sendOtp } = loadUser(async p => { payload = p; return { success: true }; });
  await sendOtp({ username: 'alice', email: 'Alice@example.com', role: 'admin', otp: '123456' });
  assert.equal(payload.to, 'alice@example.com');
  assert.match(payload.text, /123456/);
  await assert.rejects(sendOtp({ username: 'alice', email: '', otp: '123456' }), /otp_delivery_failed/);
  const failed = loadUser(async () => ({ success: false }));
  await assert.rejects(failed.sendOtp({ email: 'alice@example.com' }), /otp_delivery_failed/);
  const unconfigured = loadUser(() => assert.fail('must not send'), { MAIL_HOST: '' });
  await assert.rejects(unconfigured.sendOtp({ email: 'alice@example.com' }), /otp_delivery_failed/);
});

test('failed OTP delivery deletes the challenge', async () => {
  let deleted = 0;
  const { createChallenge } = loadUser(async () => ({ success: false }), {}, {
    cleanup: (_db, _now, cb) => cb(),
    deleteByUsername: (_db, _username, cb) => { deleted++; cb(); },
    create: (...args) => args.at(-1)()
  });
  await assert.rejects(createChallenge({}, 'alice', 'alice@example.com', { role: 'admin' }), /otp_delivery_failed/);
  assert.equal(deleted, 2);
});

test('a transient failure followed by success stops retrying', async () => {
  let calls = 0;
  const { sendAdminNotification } = load('utils/adminNotification.js', {
    './mailer': { sendMail: async () => {
      calls++;
      if (calls === 1) throw new Error('Temporary SMTP outage');
      return { success: true };
    } }
  }, env);
  assert.equal((await sendAdminNotification({ title: 'Notice', body: 'Body' })).success, true);
  assert.equal(calls, 2);
});

test('PoW events use throttled admin email and still persist the event', async () => {
  let notification;
  let persisted = false;
  const { logPowEvent } = load('utils/powLogger.js', {
    crypto,
    './adminNotification': { sendAdminNotification: async payload => { notification = payload; } },
    '../db/tablePowLog': { create: (...args) => { persisted = true; args.at(-1)(); } }
  });
  await logPowEvent({}, { scope: 'login', path: '/login', difficulty: 12 });
  assert.equal(persisted, true);
  assert.equal(notification.throttleKey, 'pow-enabled');
  assert.match(notification.body, /Scope: login/);
  notification = undefined;
  await logPowEvent({}, { scope: 'login' }, undefined, { notify: false });
  assert.equal(notification, undefined);
});
