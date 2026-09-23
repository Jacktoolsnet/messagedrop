const axios = require('axios');
const { signServiceJwt } = require('./serviceJwt');
const { resolveBaseUrl } = require('./adminLogForwarder');

// Coalesced, authenticated change hints. Actual status always comes from the DB.
// Only failed delivery retries; there is no periodic status polling.
function createImportNotifier(logger = console) {
  const baseUrl = resolveBaseUrl(process.env.ADMIN_BASE_URL, process.env.ADMIN_PORT, process.env.ADMIN_LOG_URL);
  if (!baseUrl) logger.warn('Geodata live updates disabled: admin callback URL is not configured');
  let dirty = false;
  let sending = false;
  let stopped = false;
  let timer = null;
  let failures = 0;
  function schedule(delay) {
    if (stopped || timer || sending || !baseUrl) return;
    timer = setTimeout(flush, delay);
    timer.unref?.();
  }
  async function flush() {
    timer = null;
    if (stopped || !dirty) return;
    dirty = false;
    sending = true;
    try {
      const token = await signServiceJwt({ audience: process.env.SERVICE_JWT_AUDIENCE_ADMIN || 'service.admin-backend' });
      await axios.post(`${baseUrl}/geodata-import/events`, {}, {
        headers: { Authorization: `Bearer ${token}` }, timeout: 5000
      });
      failures = 0;
    } catch (error) {
      dirty = true;
      failures++;
      if (failures === 1 || failures % 10 === 0) {
        logger.warn('Geodata live update delivery failed; retrying', { error: error.message });
      }
    } finally {
      sending = false;
      if (dirty) schedule(failures ? Math.min(30000, 1000 * 2 ** Math.min(failures, 5)) : 1000);
    }
  }
  return {
    changed() { dirty = true; schedule(1000); },
    close() { stopped = true; clearTimeout(timer); }
  };
}
module.exports = { createImportNotifier };
