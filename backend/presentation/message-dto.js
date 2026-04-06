const tableMessage = require('../db/tableMessage');

function toNullableFiniteNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function toFiniteNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeString(value, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function normalizeMultimedia(multimedia) {
  if (typeof multimedia === 'string') {
    const trimmed = multimedia.trim();
    return trimmed ? trimmed : 'null';
  }
  if (multimedia === null || multimedia === undefined) {
    return 'null';
  }
  try {
    return JSON.stringify(multimedia);
  } catch {
    return 'null';
  }
}

function createBaseMessageDto(row) {
  if (!row || typeof row !== 'object') {
    return null;
  }

  return {
    id: toFiniteNumber(row.id, 0),
    parentId: toNullableFiniteNumber(row.parentId),
    uuid: normalizeString(row.uuid).trim(),
    parentUuid: normalizeString(row.parentUuid, '') || null,
    typ: normalizeString(row.typ, tableMessage.messageType.PUBLIC) || tableMessage.messageType.PUBLIC,
    createDateTime: toNullableFiniteNumber(row.createDateTime),
    latitude: toNullableFiniteNumber(row.latitude),
    longitude: toNullableFiniteNumber(row.longitude),
    plusCode: normalizeString(row.plusCode, ''),
    message: normalizeString(row.message, ''),
    markerType: normalizeString(row.markerType, 'default') || 'default',
    style: normalizeString(row.style, ''),
    hashtags: row.hashtags ?? '',
    views: Math.max(0, toFiniteNumber(row.views, 0)),
    likes: Math.max(0, toFiniteNumber(row.likes, 0)),
    dislikes: Math.max(0, toFiniteNumber(row.dislikes, 0)),
    commentsNumber: Math.max(0, toFiniteNumber(row.commentsNumber, 0)),
    status: normalizeString(row.status, tableMessage.messageStatus.ENABLED) || tableMessage.messageStatus.ENABLED,
    userId: normalizeString(row.userId, ''),
    multimedia: normalizeMultimedia(row.multimedia)
  };
}

function toPublicMessageDto(row) {
  return createBaseMessageDto(row);
}

function toOwnerMessageDto(row) {
  const base = createBaseMessageDto(row);
  if (!base) {
    return null;
  }

  return {
    ...base,
    deleteDateTime: toNullableFiniteNumber(row.deleteDateTime),
    aiModerationDecision: normalizeString(row.aiModerationDecision, '') || null,
    aiModerationScore: toNullableFiniteNumber(row.aiModerationScore),
    aiModerationFlagged: row.aiModerationFlagged === null || row.aiModerationFlagged === undefined
      ? null
      : (row.aiModerationFlagged === true || row.aiModerationFlagged === 1 || row.aiModerationFlagged === '1'),
    aiModerationAt: toNullableFiniteNumber(row.aiModerationAt),
    patternMatch: row.patternMatch === null || row.patternMatch === undefined
      ? null
      : (row.patternMatch === true || row.patternMatch === 1 || row.patternMatch === '1'),
    patternMatchAt: toNullableFiniteNumber(row.patternMatchAt),
    manualModerationDecision: normalizeString(row.manualModerationDecision, '') || null,
    manualModerationReason: normalizeString(row.manualModerationReason, '') || null,
    manualModerationAt: toNullableFiniteNumber(row.manualModerationAt),
    manualModerationBy: normalizeString(row.manualModerationBy, '') || null,
    dsaStatusToken: normalizeString(row.dsaStatusToken, '') || null
  };
}

function toInternalMessageDto(row) {
  const owner = toOwnerMessageDto(row);
  if (!owner) {
    return null;
  }

  return {
    ...owner,
    dsaStatusTokenCreatedAt: toNullableFiniteNumber(row.dsaStatusTokenCreatedAt),
    aiModeration: normalizeString(row.aiModeration, '') || null
  };
}

function mapRows(rows, mapper) {
  return (rows || []).map((row) => mapper(row)).filter(Boolean);
}

module.exports = {
  toPublicMessageDto,
  toPublicMessageDtos: (rows) => mapRows(rows, toPublicMessageDto),
  toOwnerMessageDto,
  toOwnerMessageDtos: (rows) => mapRows(rows, toOwnerMessageDto),
  toInternalMessageDto,
  toInternalMessageDtos: (rows) => mapRows(rows, toInternalMessageDto)
};
