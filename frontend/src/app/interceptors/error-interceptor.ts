import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { catchError, throwError } from 'rxjs';
import { DisplayMessage } from '../components/utils/display-message/display-message.component';
import { ApiErrorService } from '../services/api-error.service';
import { DiagnosticLoggerService } from '../services/diagnostic-logger.service';
import { NetworkService } from '../services/network.service';
import { TranslationHelperService } from '../services/translation-helper.service';

let errorDialogRef: MatDialogRef<DisplayMessage> | null = null;

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const dialog = inject(MatDialog);
  const apiErrorService = inject(ApiErrorService);
  const networkService = inject(NetworkService);
  const i18n = inject(TranslationHelperService);
  const diagnosticLogger = inject(DiagnosticLoggerService);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        error.status === 404 &&
        (req.url.includes('/message/get/boundingbox') ||
          req.url.includes('/place/get/userId') ||
          req.url.includes('/contact/get/userId') ||
          req.url.includes('/nominatim/noboundedsearch') ||
          req.url.includes('/nominatim/boundedsearch'))
      ) {
        return throwError(() => error);
      }
      diagnosticLogger.logHttpError(req, error);
      const status = error instanceof HttpErrorResponse ? error.status : -1;
      const message = apiErrorService.getErrorMessage(error) ?? networkService.getErrorMessage(status);
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
          showSpinner: true
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
