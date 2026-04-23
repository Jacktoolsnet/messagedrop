const DEFAULT_OPENMETEO_UPSTREAM_TIMEOUT_MS = 10000;
const DEFAULT_OPENMETEO_PROXY_HEADROOM_MS = 2000;

function parsePositiveInt(value) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function resolveOpenMeteoServiceTimeoutMs() {
  return parsePositiveInt(process.env.OPENMETEO_UPSTREAM_TIMEOUT_MS)
    || DEFAULT_OPENMETEO_UPSTREAM_TIMEOUT_MS;
}

function resolveOpenMeteoProxyTimeoutMs() {
  return parsePositiveInt(process.env.OPENMETEO_PROXY_TIMEOUT_MS)
    || (resolveOpenMeteoServiceTimeoutMs() + DEFAULT_OPENMETEO_PROXY_HEADROOM_MS);
}

module.exports = {
  resolveOpenMeteoProxyTimeoutMs,
  resolveOpenMeteoServiceTimeoutMs
};
