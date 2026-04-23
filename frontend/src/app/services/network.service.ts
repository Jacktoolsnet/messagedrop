import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { environment } from '../../environments/environment';
import { DisplayMessage } from '../components/utils/display-message/display-message.component';
import { DisplayMessageConfig } from '../interfaces/display-message-config';
import { MaintenanceInfo } from '../interfaces/maintenance';
import { TranslationHelperService } from './translation-helper.service';

interface LiteNetworkInformation {
  effectiveType?: string;
  saveData?: boolean;
}

interface BackendHealthResponse {
  status?: number;
  online?: boolean;
  maintenance?: MaintenanceInfo | null;
}

@Injectable({
  providedIn: 'root'
})
export class NetworkService {
  private readonly backendHealthyPollMs = 60_000;
  private readonly backendTransportFailureThreshold = 2;

  private networkDialogRef: MatDialogRef<DisplayMessage> | undefined;
  private initialized = false;

  private readonly displayMessage = inject(MatDialog);
  private readonly http = inject(HttpClient);
  private readonly i18n = inject(TranslationHelperService);

  private readonly browserOnlineSig = signal(true);
  readonly browserOnline = this.browserOnlineSig.asReadonly();
  private readonly backendOnlineSig = signal(true);
  readonly backendOnline = this.backendOnlineSig.asReadonly();
  private readonly maintenanceInfoSig = signal<MaintenanceInfo | null>(null);
  readonly maintenanceInfo = this.maintenanceInfoSig.asReadonly();
  private backendCheckTimer?: ReturnType<typeof setTimeout>;
  private backendCheckDueAt = 0;
  private backendCheckAttempts = 0;
  private backendCheckInFlight = false;
  private backendTransportFailureCount = 0;
  private networkMessageMap = new Map<string, DisplayMessageConfig>();
  private readonly errorTitleKeyMap: Record<number, string> = {
    0: 'errors.http.title.noConnection',
    400: 'errors.http.title.badRequest',
    401: 'errors.http.title.unauthorized',
    403: 'errors.http.title.forbidden',
    404: 'errors.http.title.notFound',
    408: 'errors.http.title.requestTimeout',
    409: 'errors.http.title.conflict',
    413: 'errors.http.title.payloadTooLarge',
    415: 'errors.http.title.unsupportedMediaType',
    422: 'errors.http.title.unprocessableEntity',
    429: 'errors.http.title.tooManyRequests',
    500: 'errors.http.title.serverError',
    502: 'errors.http.title.badGateway',
    503: 'errors.http.title.serviceUnavailable',
    504: 'errors.http.title.gatewayTimeout'
  };

  private readonly errorMessageKeyMap: Record<number, string> = {
    0: 'errors.http.message.noConnection',
    400: 'errors.http.message.badRequest',
    401: 'errors.http.message.unauthorized',
    403: 'errors.http.message.forbidden',
    404: 'errors.http.message.notFound',
    408: 'errors.http.message.requestTimeout',
    409: 'errors.http.message.conflict',
    413: 'errors.http.message.payloadTooLarge',
    415: 'errors.http.message.unsupportedMediaType',
    422: 'errors.http.message.unprocessableEntity',
    429: 'errors.http.message.tooManyRequests',
    500: 'errors.http.message.serverError',
    502: 'errors.http.message.badGateway',
    503: 'errors.http.message.serviceUnavailable',
    504: 'errors.http.message.gatewayTimeout'
  };

  init() {
    if (this.initialized) {
      return;
    }

    this.initialized = true;
    this.browserOnlineSig.set(this.isBrowserOnline());

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.browserOnlineSig.set(true);
        this.networkDialogRef?.close();
        this.networkDialogRef = undefined;
        this.requestBackendCheck(true);
      });

      window.addEventListener('offline', () => {
        this.browserOnlineSig.set(false);
        this.stopBackendMonitoring();
        this.openBrowserOfflineDialog();
      });
    }

    if (!this.browserOnlineSig()) {
      this.openBrowserOfflineDialog();
      return;
    }

    this.requestBackendCheck(true);
  }

  isSlowConnection(): boolean {
    const nav = navigator as Navigator & {
      connection?: LiteNetworkInformation;
      mozConnection?: LiteNetworkInformation;
      webkitConnection?: LiteNetworkInformation;
    };
    const conn = nav.connection || nav.mozConnection || nav.webkitConnection;

    if (!conn) {
      // Browser did not support the api → assume as slow.
      return true;
    }

    const effectiveType = conn.effectiveType || '';
    const saveData = conn.saveData || false;

    const slowTypes = ['slow-2g', '2g', '3g'];

    return saveData || slowTypes.includes(effectiveType);
  }

  setNetworkMessageConfig(url: string, config: DisplayMessageConfig): void {
    this.networkMessageMap.set(url, config);
  }

  showLoadingDialog(url: string): MatDialogRef<DisplayMessage> | undefined {
    if (this.networkMessageMap.get(url)) {
      return this.displayMessage.open(DisplayMessage, {
        panelClass: '',
        closeOnNavigation: false,
        data: this.networkMessageMap.get(url),
        maxWidth: '90vw',
        maxHeight: '90vh',
        hasBackdrop: true,
        backdropClass: 'dialog-backdrop',
        disableClose: false,
        autoFocus: false
      });
    }
    return undefined;
  }

  isShowAlways(url: string): boolean {
    return this.networkMessageMap.get(url)?.showAlways || false;
  }

  isOnline(): boolean {
    return this.browserOnlineSig();
  }

  setMaintenanceInfo(info: MaintenanceInfo | null): void {
    this.maintenanceInfoSig.set(info);
  }

  clearMaintenanceInfo(): void {
    this.maintenanceInfoSig.set(null);
  }

  recordBackendReachable(): void {
    this.backendTransportFailureCount = 0;
    this.backendCheckAttempts = 0;
    this.clearMaintenanceInfo();
    this.updateBackendOnlineState(true);
    this.scheduleBackendCheckWithDelay(this.backendHealthyPollMs);
  }

  recordBackendMaintenance(info: MaintenanceInfo): void {
    this.backendTransportFailureCount = 0;
    this.backendCheckAttempts = 0;
    this.setMaintenanceInfo(info);
    this.updateBackendOnlineState(true);
    this.scheduleBackendCheckWithDelay(this.backendHealthyPollMs);
  }

  requestBackendCheck(immediate = false): void {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return;
    }
    const delay = immediate ? 0 : (this.backendOnlineSig() ? this.backendHealthyPollMs : this.getBackendRetryDelay());
    this.scheduleBackendCheckWithDelay(delay);
  }

  private updateBackendOnlineState(online: boolean): void {
    if (this.backendOnlineSig() === online) {
      return;
    }
    this.backendOnlineSig.set(online);
    if (!online) {
      this.clearMaintenanceInfo();
    }
  }

  private scheduleBackendCheckWithDelay(delayMs: number): void {
    if (this.backendCheckInFlight) {
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return;
    }

    const delay = Math.max(0, delayMs);
    const dueAt = Date.now() + delay;

    if (this.backendCheckTimer && this.backendCheckDueAt && this.backendCheckDueAt <= dueAt) {
      return;
    }

    if (this.backendCheckTimer) {
      clearTimeout(this.backendCheckTimer);
    }

    this.backendCheckDueAt = dueAt;
    this.backendCheckTimer = setTimeout(() => {
      this.backendCheckTimer = undefined;
      this.backendCheckDueAt = 0;
      this.checkBackendOnline();
    }, delay);
  }

  private stopBackendMonitoring(): void {
    if (this.backendCheckTimer) {
      clearTimeout(this.backendCheckTimer);
      this.backendCheckTimer = undefined;
    }
    this.backendCheckDueAt = 0;
    this.backendCheckAttempts = 0;
    this.backendTransportFailureCount = 0;
    this.backendCheckInFlight = false;
  }

  private getBackendRetryDelay(): number {
    if (this.backendCheckAttempts < 1) {
      return 3_000;
    }
    if (this.backendCheckAttempts < 3) {
      return 5_000;
    }
    if (this.backendCheckAttempts < 6) {
      return 10_000;
    }
    if (this.backendCheckAttempts < 12) {
      return 30_000;
    }
    return 60_000;
  }

  private checkBackendOnline(): void {
    if (this.backendCheckInFlight) {
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      this.scheduleBackendCheckWithDelay(this.getBackendRetryDelay());
      return;
    }

    this.backendCheckInFlight = true;
    const url = `${environment.apiUrl}/health`;
    const headers = new HttpHeaders({
      'x-skip-ui': 'true',
      'x-skip-backend-status': 'true',
      'x-skip-diagnostics': 'true'
    });

    this.http.get<BackendHealthResponse>(url, { headers, withCredentials: true }).subscribe({
      next: (response) => {
        this.backendCheckInFlight = false;
        this.handleBackendHealthResponse(response);
      },
      error: (error: HttpErrorResponse) => {
        this.backendCheckInFlight = false;
        this.handleBackendHealthTransportError(error);
      }
    });
  }

  private handleBackendHealthResponse(response: BackendHealthResponse | null | undefined): void {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return;
    }

    const maintenance = this.normalizeMaintenanceInfo(response?.maintenance);
    this.backendTransportFailureCount = 0;

    if (response?.online === false) {
      this.backendCheckAttempts += 1;
      this.updateBackendOnlineState(false);
      if (maintenance?.enabled) {
        this.setMaintenanceInfo(maintenance);
      }
      this.scheduleBackendCheckWithDelay(this.getBackendRetryDelay());
      return;
    }

    this.backendCheckAttempts = 0;
    this.updateBackendOnlineState(true);
    if (maintenance?.enabled) {
      this.setMaintenanceInfo(maintenance);
    } else {
      this.clearMaintenanceInfo();
    }
    this.scheduleBackendCheckWithDelay(this.backendHealthyPollMs);
  }

  private handleBackendHealthTransportError(_error: HttpErrorResponse): void {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return;
    }

    this.backendTransportFailureCount += 1;
    this.backendCheckAttempts += 1;

    if (this.backendTransportFailureCount >= this.backendTransportFailureThreshold || !this.backendOnlineSig()) {
      this.updateBackendOnlineState(false);
    }

    this.scheduleBackendCheckWithDelay(this.getBackendRetryDelay());
  }

  private normalizeMaintenanceInfo(value: MaintenanceInfo | null | undefined): MaintenanceInfo | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    return {
      enabled: Boolean(value.enabled),
      startsAt: this.normalizeNumber(value.startsAt),
      endsAt: this.normalizeNumber(value.endsAt),
      reason: this.normalizeText(value.reason),
      reasonEn: this.normalizeText(value.reasonEn),
      reasonEs: this.normalizeText(value.reasonEs),
      reasonFr: this.normalizeText(value.reasonFr),
      updatedAt: this.normalizeNumber(value.updatedAt)
    };
  }

  private normalizeNumber(value: unknown): number | null {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }

  private normalizeText(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  private openBrowserOfflineDialog(): void {
    this.networkDialogRef?.close();
    this.networkDialogRef = this.displayMessage?.open(DisplayMessage, {
      panelClass: '',
      closeOnNavigation: false,
      data: {
        showAlways: true,
        title: this.i18n.t('errors.offline.title'),
        image: '',
        icon: 'wifi_off',
        message: this.i18n.t('errors.offline.message'),
        button: this.i18n.t('common.actions.ok'),
        delay: 4000,
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
    this.networkDialogRef?.afterClosed().subscribe(() => {
      if (this.networkDialogRef) {
        this.networkDialogRef = undefined;
      }
    });
  }

  getErrorTitle(status: number): string {
    if (status === 0 && this.isBrowserOnline()) {
      return this.i18n.t('common.serverDown.title');
    }
    const key = this.errorTitleKeyMap[status] ?? 'errors.http.title.unexpected';
    return this.i18n.t(key);
  }

  getErrorIcon(status: number): string {
    if (status === 0 && this.isBrowserOnline()) {
      return 'cloud_off';
    }
    switch (status) {
      case 0: return 'wifi_off';             // Kein Internet
      case 400: return 'error_outline';      // Bad Request
      case 401: return 'lock';               // Unauthorized
      case 403: return 'block';              // Forbidden
      case 404: return 'search_off';         // Not Found
      case 408: return 'hourglass_empty';    // Timeout
      case 429: return 'schedule';           // Rate Limit
      case 500: return 'warning';            // Server Error
      case 502: return 'cloud_off';          // Bad Gateway
      case 503: return 'cloud_queue';        // Service Unavailable
      case 504: return 'hourglass_disabled'; // Gateway Timeout
      default: return 'error';               // Unbekannter Fehler
    }
  }

  getErrorMessage(status: number): string {
    if (status === 0 && this.isBrowserOnline()) {
      return this.i18n.t('common.serverDown.message');
    }
    const key = this.errorMessageKeyMap[status] ?? 'errors.http.message.unexpected';
    return this.i18n.t(key);
  }

  private isBrowserOnline(): boolean {
    if (typeof navigator === 'undefined') {
      return true;
    }
    return navigator.onLine;
  }
}
