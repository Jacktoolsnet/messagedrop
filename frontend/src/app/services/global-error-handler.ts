import { ErrorHandler, Injectable, inject, isDevMode } from '@angular/core';
import { DiagnosticLoggerService } from './diagnostic-logger.service';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private readonly logger = inject(DiagnosticLoggerService);

  handleError(error: unknown): void {
    this.logger.logRuntimeError(error);
    if (isDevMode()) {
      console.error(error);
    }
  }
}
