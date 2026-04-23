import { HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { catchError, tap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { DisplayMessage } from '../components/utils/display-message/display-message.component';
import { MaintenanceInfo } from '../interfaces/maintenance';
import { ApiErrorService } from '../services/api-error.service';
import { DiagnosticLoggerService } from '../services/diagnostic-logger.service';
import { NetworkService } from '../services/network.service';
import { TranslationHelperService } from '../services/translation-helper.service';

let errorDialogRef: MatDialogRef<DisplayMessage> | null = null;

const isBackendRequest = (url: string): boolean => {
  if (!environment.apiUrl) {
    return false;
  }
  return url.startsWith(environment.apiUrl);
};

const normalizeNumber = (value: unknown): number | null => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const normalizeText = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const parseMaintenanceInfo = (error: unknown): MaintenanceInfo | null => {
  if (!(error instanceof HttpErrorResponse)) return null;
  const payload = error.error;
  if (!payload || typeof payload !== 'object') return null;
  const errorCode = (payload as { errorCode?: unknown }).errorCode;
  if (errorCode !== 'MAINTENANCE') return null;
  const maintenanceRaw = (payload as { maintenance?: unknown }).maintenance;
  if (!maintenanceRaw || typeof maintenanceRaw !== 'object') return null;
  const data = maintenanceRaw as Partial<Record<keyof MaintenanceInfo, unknown>>;
  return {
    enabled: Boolean(data.enabled),
    startsAt: normalizeNumber(data.startsAt),
    endsAt: normalizeNumber(data.endsAt),
    reason: normalizeText(data.reason),
    reasonEn: normalizeText(data.reasonEn),
    reasonEs: normalizeText(data.reasonEs),
    reasonFr: normalizeText(data.reasonFr),
    updatedAt: normalizeNumber(data.updatedAt)
  };
};

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const dialog = inject(MatDialog);
  const apiErrorService = inject(ApiErrorService);
  const networkService = inject(NetworkService);
  const i18n = inject(TranslationHelperService);
  const diagnosticLogger = inject(DiagnosticLoggerService);
  const backendRequest = isBackendRequest(req.url);
  const skipUi = req.headers.has('x-skip-ui');
  const skipBackendStatus = req.headers.has('x-skip-backend-status');
  const skipDiagnostics = req.headers.has('x-skip-diagnostics');

  return next(req).pipe(
    tap((event) => {
      if (backendRequest && !skipBackendStatus && event instanceof HttpResponse) {
        networkService.recordBackendReachable();
      }
    }),
    catchError((error: unknown) => {
      if (!skipDiagnostics) {
        diagnosticLogger.logHttpError(req, error);
      }
      const status = error instanceof HttpErrorResponse ? error.status : -1;
      const maintenanceInfo = backendRequest ? parseMaintenanceInfo(error) : null;
      const message = apiErrorService.getErrorMessage(error) ?? networkService.getErrorMessage(status);
      if (backendRequest && !skipBackendStatus) {
        if (maintenanceInfo?.enabled) {
          networkService.recordBackendMaintenance(maintenanceInfo);
        } else if (status === 0 || status >= 500) {
          networkService.requestBackendCheck(true);
        } else {
          networkService.recordBackendReachable();
        }
      }

      const backendStatusAlreadyVisible = backendRequest
        && !skipBackendStatus
        && (maintenanceInfo?.enabled || networkService.maintenanceInfo()?.enabled || !networkService.backendOnline());
      const repeatedBackendStatusError = status === 0 || status === 502 || status === 503 || status === 504;

      if (backendStatusAlreadyVisible && repeatedBackendStatusError) {
        return throwError(() => error);
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
        backdropClass: 'dialog-backdrop',
        disableClose: false,
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
