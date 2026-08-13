const path = require('node:path');
const fs = require('node:fs/promises');

function downloadDirectory() {
  const configured = String(process.env.OVERPASS_DOWNLOAD_DIR || '').trim();
  if (!configured) return path.join(__dirname, 'downloads');
  return path.isAbsolute(configured) ? configured : path.resolve(__dirname, configured);
}

async function ensureDownloadDirectory() {
  const directory = downloadDirectory();
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  return directory;
}

module.exports = { downloadDirectory, ensureDownloadDirectory };
