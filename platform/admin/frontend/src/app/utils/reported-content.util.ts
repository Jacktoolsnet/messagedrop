import { PublicMessage } from '../interfaces/public-message.interface';
import { ReportedContentPayload, ReportedMultimedia } from '../interfaces/reported-content.interface';

type JsonObject = Record<string, unknown>;

function parseJsonLike(value: unknown): unknown {
  let current = value;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (typeof current !== 'string') {
      break;
    }
    const trimmed = current.trim();
    if (!trimmed) {
      return null;
    }
    try {
      current = JSON.parse(trimmed) as unknown;
    } catch {
      break;
    }
  }
  return current;
}

function asObject(value: unknown): JsonObject | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as JsonObject;
}

function normalizeReportedMultimedia(value: unknown): ReportedMultimedia | null {
  const parsed = parseJsonLike(value);
  const object = asObject(parsed);
  return object ? object as ReportedMultimedia : null;
}

function normalizeContentObject<T>(value: unknown): T | null {
  const parsed = parseJsonLike(value);
  const object = asObject(parsed);
  if (!object) {
    return null;
  }

  const normalized: JsonObject = { ...object };
  if ('multimedia' in normalized) {
    normalized['multimedia'] = normalizeReportedMultimedia(normalized['multimedia']);
  }

  return normalized as T;
}

export function parseReportedContentPayload(value: unknown): ReportedContentPayload | null {
  return normalizeContentObject<ReportedContentPayload>(value);
}

export function parsePublicMessageDetailContent(value: unknown): PublicMessage | null {
  return normalizeContentObject<PublicMessage>(value);
}
