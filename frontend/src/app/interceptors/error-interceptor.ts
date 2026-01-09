import { HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { catchError, tap, throwError } from 'rxjs';
import { DisplayMessage } from '../components/utils/display-message/display-message.component';
import { environment } from '../../environments/environment';
import { ApiErrorService } from '../services/api-error.service';
import { DiagnosticLoggerService } from '../services/diagnostic-logger.service';
import { NetworkService } from '../services/network.service';
import { TranslationHelperService } from '../services/translation-helper.service';

let errorDialogRef: MatDialogRef<DisplayMessage> | null = null;
const backendOfflineStatuses = new Set([0, 502, 503, 504]);

const isBackendRequest = (url: string): boolean => {
  if (!environment.apiUrl) {
    return false;
  }
  return url.startsWith(environment.apiUrl);
};

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const dialog = inject(MatDialog);
  const apiErrorService = inject(ApiErrorService);
  const networkService = inject(NetworkService);
  const i18n = inject(TranslationHelperService);
  const diagnosticLogger = inject(DiagnosticLoggerService);
  const backendRequest = isBackendRequest(req.url);
  const skipUi = req.headers.has('x-skip-ui');

  return next(req).pipe(
    tap((event) => {
      if (backendRequest && event instanceof HttpResponse) {
        networkService.setBackendOnline(true);
      }
    }),
    catchError((error: unknown) => {
      diagnosticLogger.logHttpError(req, error);
      const status = error instanceof HttpErrorResponse ? error.status : -1;
      const message = apiErrorService.getErrorMessage(error) ?? networkService.getErrorMessage(status);
      if (backendRequest) {
        if (backendOfflineStatuses.has(status)) {
          networkService.setBackendOnline(false);
          return throwError(() => error);
        }
        networkService.setBackendOnline(true);
      }
      if (skipUi) {
        return throwError(() => error);
      }
      const title = networkService.getErrorTitle(status);
      const icon = networkService.getErrorIcon(status);

      errorDialogRef?.close();
      const ref = dialog.open(DisplayMessage, {
        panelClass: '',
        closeOnNavigation: false,
        data: {
          showAlways: true,
          title,
          image: '',
          icon,
          message,
          button: i18n.t('common.actions.ok'),
          delay: 2000,
          showSpinner: false,
          autoclose: true
        },
        maxWidth: '90vw',
        maxHeight: '90vh',
        hasBackdrop: true,
        autoFocus: false
      });
      errorDialogRef = ref;
      ref.afterClosed().subscribe(() => {
        if (errorDialogRef === ref) {
          errorDialogRef = null;
        }
      });
      return throwError(() => error);
    })
  );
};
