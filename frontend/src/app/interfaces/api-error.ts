export type ApiErrorCode =
  | 'NOTE_TOO_LARGE'
  | 'UNAUTHORIZED'
  | 'RATE_LIMIT';

export interface ApiErrorPayload {
  errorCode: ApiErrorCode;
  params?: Record<string, unknown>;
}
