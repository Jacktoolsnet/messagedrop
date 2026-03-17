const LATITUDE_MAX = 90;
const LONGITUDE_MAX = 180;
const CODE_PRECISION_NORMAL = 10;
const MAX_DIGIT_COUNT = 15;
const SEPARATOR = '+';
const SEPARATOR_POSITION = 8;
const PADDING_CHARACTER = '0';
const CODE_ALPHABET = '23456789CFGHJMPQRVWX';
const ENCODING_BASE = CODE_ALPHABET.length;
const PAIR_CODE_LENGTH = 10;
const GRID_ROWS = 5;
const GRID_COLUMNS = 4;
const PAIR_PRECISION = Math.pow(ENCODING_BASE, 3);
const FINAL_LAT_PRECISION = PAIR_PRECISION * Math.pow(GRID_ROWS, MAX_DIGIT_COUNT - PAIR_CODE_LENGTH);
const FINAL_LNG_PRECISION = PAIR_PRECISION * Math.pow(GRID_COLUMNS, MAX_DIGIT_COUNT - PAIR_CODE_LENGTH);

function clipLatitude(latitude) {
  return Math.min(LATITUDE_MAX, Math.max(-LATITUDE_MAX, latitude));
}

function computeLatitudePrecision(codeLength) {
  if (codeLength <= 10) {
    return Math.pow(20, Math.floor(codeLength / -2 + 2));
  }
  return Math.pow(20, -3) / Math.pow(GRID_ROWS, codeLength - 10);
}

function normalizeLongitude(longitude) {
  let output = longitude;
  while (output < -LONGITUDE_MAX) {
    output += 360;
  }
  while (output >= LONGITUDE_MAX) {
    output -= 360;
  }
  return output;
}

function encodePlusCode(latitude, longitude, codeLength = CODE_PRECISION_NORMAL) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return '';
  }

  if (codeLength < 2 || (codeLength < PAIR_CODE_LENGTH && codeLength % 2 === 1)) {
    throw new Error('invalid_plus_code_length');
  }

  const editedCodeLength = Math.min(MAX_DIGIT_COUNT, codeLength);
  let editedLatitude = clipLatitude(latitude);
  const editedLongitude = normalizeLongitude(longitude);

  if (editedLatitude === LATITUDE_MAX) {
    editedLatitude -= computeLatitudePrecision(editedCodeLength);
  }

  let code = '';
  let latVal = Math.floor(Math.round((editedLatitude + LATITUDE_MAX) * FINAL_LAT_PRECISION * 1e6) / 1e6);
  let lngVal = Math.floor(Math.round((editedLongitude + LONGITUDE_MAX) * FINAL_LNG_PRECISION * 1e6) / 1e6);

  if (editedCodeLength > PAIR_CODE_LENGTH) {
    for (let index = 0; index < MAX_DIGIT_COUNT - PAIR_CODE_LENGTH; index += 1) {
      const latDigit = latVal % GRID_ROWS;
      const lngDigit = lngVal % GRID_COLUMNS;
      const alphabetIndex = latDigit * GRID_COLUMNS + lngDigit;
      code = CODE_ALPHABET.charAt(alphabetIndex) + code;
      latVal = Math.floor(latVal / GRID_ROWS);
      lngVal = Math.floor(lngVal / GRID_COLUMNS);
    }
  } else {
    latVal = Math.floor(latVal / Math.pow(GRID_ROWS, MAX_DIGIT_COUNT - PAIR_CODE_LENGTH));
    lngVal = Math.floor(lngVal / Math.pow(GRID_COLUMNS, MAX_DIGIT_COUNT - PAIR_CODE_LENGTH));
  }

  for (let index = 0; index < PAIR_CODE_LENGTH / 2; index += 1) {
    code = CODE_ALPHABET.charAt(lngVal % ENCODING_BASE) + code;
    code = CODE_ALPHABET.charAt(latVal % ENCODING_BASE) + code;
    latVal = Math.floor(latVal / ENCODING_BASE);
    lngVal = Math.floor(lngVal / ENCODING_BASE);
  }

  code = code.substring(0, SEPARATOR_POSITION) + SEPARATOR + code.substring(SEPARATOR_POSITION);

  if (editedCodeLength >= SEPARATOR_POSITION) {
    return code.substring(0, editedCodeLength + 1);
  }

  return code.substring(0, editedCodeLength)
    + Array(SEPARATOR_POSITION - editedCodeLength + 1).join(PADDING_CHARACTER)
    + SEPARATOR;
}

module.exports = {
  encodePlusCode
};
