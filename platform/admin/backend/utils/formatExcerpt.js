function formatExcerpt(value, maxLen = 180) {
  const text = String(value ?? '').trim();
  if (!text) return '-';
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen - 3)}...`;
}

module.exports = { formatExcerpt };
