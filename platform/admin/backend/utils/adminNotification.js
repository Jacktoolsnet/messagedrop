const { sendMail } = require('./mailer');

// Fixed categories only: never use user-controlled values as keys.
const throttledCategories = new Set(['login-failure', 'pow-enabled']);
const lastSent = new Map();
const THROTTLE_MS = 5 * 60 * 1000;

async function sendAdminNotification({ title, body, logger, throttleKey }) {
  const to = (process.env.ADMIN_NOTIFICATION_EMAIL || process.env.ADMIN_ROOT_EMAIL || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    logger?.error?.('Admin email recipient missing or invalid');
    return { success: false, reason: 'invalid_recipient' };
  }
  if (throttledCategories.has(throttleKey)) {
    const now = Date.now();
    if (lastSent.has(throttleKey) && now - lastSent.get(throttleKey) < THROTTLE_MS) {
      logger?.info?.('Admin email suppressed by rate limit', { category: throttleKey });
      return { success: false, suppressed: true };
    }
    // Reserve before awaiting SMTP so concurrent requests cannot bypass the limit.
    lastSent.set(throttleKey, now);
  }

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    let result;
    try {
      result = await sendMail({ to, subject: title, text: body, logger });
    } catch (error) {
      result = { success: false, error };
    }
    if (result?.success) return result;
    // Configuration errors and permanent SMTP errors cannot be repaired by retrying.
    const code = result?.error?.responseCode;
    if (result?.reason === 'not_configured' || result?.reason === 'invalid_payload'
      || result?.error?.code === 'EAUTH' || code >= 500 || attempt === 3) {
      logger?.error?.('Admin email delivery failed', { subject: title, attempts: attempt });
      return { success: false };
    }
    await new Promise(resolve => setTimeout(resolve, attempt * 1000));
  }
}

module.exports = { sendAdminNotification };
