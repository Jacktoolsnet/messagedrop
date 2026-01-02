const DAY_MS = 24 * 60 * 60 * 1000;

function parseRetentionMs(value, fallbackMs) {
  const raw = String(value ?? '').trim().toLowerCase();
  const match = raw.match(/^(\d+)\s*(ms|s|m|h|d)?$/);
  if (!match) {
    return fallbackMs;
  }
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) {
    return fallbackMs;
  }
  const unit = match[2] || 'd';
  switch (unit) {
    case 'ms':
      return amount;
    case 's':
      return amount * 1000;
    case 'm':
      return amount * 60 * 1000;
    case 'h':
      return amount * 60 * 60 * 1000;
    case 'd':
    default:
      return amount * DAY_MS;
  }
}

module.exports = {
  DAY_MS,
  parseRetentionMs
};
