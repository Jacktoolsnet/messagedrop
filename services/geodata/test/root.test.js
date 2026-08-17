const test = require('node:test');
const assert = require('node:assert/strict');
const { serviceStatus } = require('../routes/root');

test('advertises the public ODbL export manifest from the service status', () => {
  const status = serviceStatus();
  assert.equal(status.dataExports.manifest, '/geodata/exports');
  assert.equal(status.dataExports.format, 'JSONL.gz');
  assert.equal(status.dataExports.license, 'ODbL 1.0');
  assert.equal(status.dataExports.licenseUrl, 'https://opendatacommons.org/licenses/odbl/1-0/');
});
