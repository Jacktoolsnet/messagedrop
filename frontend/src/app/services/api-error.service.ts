import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { ApiErrorCode, ApiErrorPayload } from '../interfaces/api-error';
import { TranslationHelperService } from './translation-helper.service';

const ERROR_CODE_TO_KEY: Record<ApiErrorCode, string> = {
  NOTE_TOO_LARGE: 'errors.noteTooLarge',
  UNAUTHORIZED: 'errors.unauthorized',
  RATE_LIMIT: 'errors.rateLimit'
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
