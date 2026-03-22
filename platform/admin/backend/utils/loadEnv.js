const path = require('path');
const dotenv = require('dotenv');

let loaded = false;

function loadEnv() {
  if (loaded) {
    return;
  }

  const candidates = [
    path.resolve(__dirname, '../.env'),
    path.resolve(__dirname, '../../../../.env')
  ];

  for (const candidate of candidates) {
    dotenv.config({ path: candidate, override: false });
  }

  loaded = true;
}

module.exports = { loadEnv };
