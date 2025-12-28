export type ApiErrorCode =
  | 'NOTE_TOO_LARGE'
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'UNPROCESSABLE_ENTITY'
  | 'REQUEST_TIMEOUT'
  | 'RATE_LIMIT'
  | 'INTERNAL_ERROR'
  | 'BAD_GATEWAY'
  | 'SERVICE_UNAVAILABLE'
  | 'GATEWAY_TIMEOUT';

export interface ApiErrorPayload {
  errorCode: ApiErrorCode;
  params?: Record<string, unknown>;
}
