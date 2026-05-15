const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const EVIDENCE_FILE_TYPES = Object.freeze({
  pdf: { extension: '.pdf', mimeType: 'application/pdf' },
  png: { extension: '.png', mimeType: 'image/png' },
  jpg: { extension: '.jpg', mimeType: 'image/jpeg' },
  gif: { extension: '.gif', mimeType: 'image/gif' },
  webp: { extension: '.webp', mimeType: 'image/webp' }
});

function startsWith(buffer, bytes, offset = 0) {
  if (!Buffer.isBuffer(buffer) || buffer.length < offset + bytes.length) {
    return false;
  }
  return bytes.every((byte, index) => buffer[offset + index] === byte);
}

function ascii(buffer, start, end) {
  if (!Buffer.isBuffer(buffer) || buffer.length < end) {
    return '';
  }
  return buffer.toString('ascii', start, end);
}

function hasOnlyTrailingWhitespace(buffer, offset) {
  for (let index = offset; index < buffer.length; index += 1) {
    const byte = buffer[index];
    if (byte !== 0x09 && byte !== 0x0a && byte !== 0x0d && byte !== 0x20) {
      return false;
    }
  }
  return true;
}

function hasValidPngEnd(buffer) {
  let offset = 8;
  while (offset + 12 <= buffer.length) {
    const chunkLength = buffer.readUInt32BE(offset);
    const chunkType = ascii(buffer, offset + 4, offset + 8);
    const chunkEnd = offset + 12 + chunkLength;
    if (chunkEnd > buffer.length) {
      return false;
    }
    if (chunkType === 'IEND') {
      return chunkEnd === buffer.length;
    }
    offset = chunkEnd;
  }
  return false;
}

function hasPdfEofAtEnd(buffer) {
  const eofOffset = buffer.lastIndexOf(Buffer.from('%%EOF', 'ascii'));
  if (eofOffset < 0) {
    return false;
  }
  return hasOnlyTrailingWhitespace(buffer, eofOffset + 5);
}

function hasValidWebpLength(buffer) {
  if (buffer.length < 12) {
    return false;
  }
  const riffPayloadLength = buffer.readUInt32LE(4);
  return riffPayloadLength + 8 === buffer.length;
}

function detectEvidenceFileType(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) {
    return null;
  }

  if (startsWith(buffer, [0x25, 0x50, 0x44, 0x46, 0x2d]) && hasPdfEofAtEnd(buffer)) {
    return { kind: 'pdf', ...EVIDENCE_FILE_TYPES.pdf };
  }

  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) && hasValidPngEnd(buffer)) {
    return { kind: 'png', ...EVIDENCE_FILE_TYPES.png };
  }

  if (startsWith(buffer, [0xff, 0xd8, 0xff]) && startsWith(buffer, [0xff, 0xd9], buffer.length - 2)) {
    return { kind: 'jpg', ...EVIDENCE_FILE_TYPES.jpg };
  }

  const gifHeader = ascii(buffer, 0, 6);
  if ((gifHeader === 'GIF87a' || gifHeader === 'GIF89a') && buffer[buffer.length - 1] === 0x3b) {
    return { kind: 'gif', ...EVIDENCE_FILE_TYPES.gif };
  }

  if (ascii(buffer, 0, 4) === 'RIFF' && ascii(buffer, 8, 12) === 'WEBP' && hasValidWebpLength(buffer)) {
    return { kind: 'webp', ...EVIDENCE_FILE_TYPES.webp };
  }

  return null;
}

function unsupportedEvidenceFileError() {
  const error = new Error('unsupported_file_type');
  error.code = 'UNSUPPORTED_EVIDENCE_FILE_TYPE';
  return error;
}

function isUnsupportedEvidenceFileError(error) {
  return error?.code === 'UNSUPPORTED_EVIDENCE_FILE_TYPE';
}

async function persistEvidenceFile(file, uploadDir) {
  const detected = detectEvidenceFileType(file?.buffer);
  if (!detected) {
    throw unsupportedEvidenceFileError();
  }

  await fs.promises.mkdir(uploadDir, { recursive: true });
  const storedName = `${Date.now()}-${crypto.randomUUID()}${detected.extension}`;
  const filePath = path.join(uploadDir, storedName);
  await fs.promises.writeFile(filePath, file.buffer, { flag: 'wx' });

  return {
    storedName,
    fileName: storedName,
    mimeType: detected.mimeType,
    kind: detected.kind
  };
}

module.exports = {
  detectEvidenceFileType,
  isUnsupportedEvidenceFileError,
  persistEvidenceFile
};
