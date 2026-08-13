const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_BASE_URLS,
  normalizeBaseUrls,
  isRetryableUpstreamError,
  upstreamErrorLabel
} = require('../clients/overpass-client');

test('uses two distinct public instances by default', () => {
  assert.deepEqual(normalizeBaseUrls(), DEFAULT_BASE_URLS);
});

test('accepts comma-separated fallback instances and removes duplicates', () => {
  assert.deepEqual(normalizeBaseUrls('https://one.example/api, https://two.example/api,https://one.example/api'), [
    'https://one.example/api',
    'https://two.example/api'
  ]);
});

test('only retries temporary upstream failures', () => {
  assert.equal(isRetryableUpstreamError({ isAxiosError: true, response: { status: 429 } }), true);
  assert.equal(isRetryableUpstreamError({ isAxiosError: true, code: 'ECONNREFUSED' }), true);
  assert.equal(isRetryableUpstreamError({ isAxiosError: true, response: { status: 400 } }), false);
});

test('describes HTTP and transport errors for endpoint diagnostics', () => {
  assert.equal(upstreamErrorLabel({ response: { status: 504 } }), 'HTTP 504');
  assert.equal(upstreamErrorLabel({ code: 'ECONNREFUSED' }), 'ECONNREFUSED');
});
