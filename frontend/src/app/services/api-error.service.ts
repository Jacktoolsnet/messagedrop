import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { ApiErrorCode, ApiErrorPayload } from '../interfaces/api-error';
import { TranslationHelperService } from './translation-helper.service';

const ERROR_CODE_TO_KEY: Record<ApiErrorCode, string> = {
  NOTE_TOO_LARGE: 'errors.noteTooLarge',
  BAD_REQUEST: 'errors.http.message.badRequest',
  UNAUTHORIZED: 'errors.unauthorized',
  FORBIDDEN: 'errors.http.message.forbidden',
  NOT_FOUND: 'errors.http.message.notFound',
  CONFLICT: 'errors.http.message.conflict',
  PAYLOAD_TOO_LARGE: 'errors.http.message.payloadTooLarge',
  UNSUPPORTED_MEDIA_TYPE: 'errors.http.message.unsupportedMediaType',
  UNPROCESSABLE_ENTITY: 'errors.http.message.unprocessableEntity',
  REQUEST_TIMEOUT: 'errors.http.message.requestTimeout',
  RATE_LIMIT: 'errors.rateLimit',
  MAINTENANCE: 'errors.maintenance',
  INTERNAL_ERROR: 'errors.http.message.serverError',
  BAD_GATEWAY: 'errors.http.message.badGateway',
  SERVICE_UNAVAILABLE: 'errors.http.message.serviceUnavailable',
  GATEWAY_TIMEOUT: 'errors.http.message.gatewayTimeout'
};

@Injectable({ providedIn: 'root' })
export class ApiErrorService {
  private readonly translator = inject(TranslationHelperService);

  getErrorMessage(error: unknown): string | null {
    const payload = this.extractApiErrorPayload(error);
    if (payload) {
      const key = ERROR_CODE_TO_KEY[payload.errorCode];
      return this.translator.t(key, payload.params);
    }

    return null;
  }

  private extractApiErrorPayload(error: unknown): ApiErrorPayload | null {
    if (this.isApiErrorPayload(error)) {
      return error;
    }

    if (error instanceof HttpErrorResponse) {
      const candidate = error.error;
      if (this.isApiErrorPayload(candidate)) {
        return candidate;
      }
    }

    return null;
  }

  private isApiErrorPayload(value: unknown): value is ApiErrorPayload {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const candidate = value as { errorCode?: unknown };
    return typeof candidate.errorCode === 'string' && candidate.errorCode in ERROR_CODE_TO_KEY;
  }
}
