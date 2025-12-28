import { Injectable, inject } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { DisplayMessage } from '../components/utils/display-message/display-message.component';
import { DisplayMessageConfig } from '../interfaces/display-message-config';
import { TranslationHelperService } from './translation-helper.service';

interface LiteNetworkInformation {
  effectiveType?: string;
  saveData?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class NetworkService {

  private networkDialogRef: MatDialogRef<DisplayMessage> | undefined;

  private readonly displayMessage = inject(MatDialog);
  private readonly i18n = inject(TranslationHelperService);

  online = true;
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
    window.addEventListener('online', () => {
      this.online = true;
      this.networkDialogRef?.close();
    });
    window.addEventListener('offline', () => {
      this.online = false;
      this.networkDialogRef = this.displayMessage?.open(DisplayMessage, {
        panelClass: '',
        closeOnNavigation: false,
        data: {
          showAlways: true,
          title: this.i18n.t('errors.offline.title'),
          image: '',
          icon: '',
          message: this.i18n.t('errors.offline.message'),
          button: '',
          delay: 0,
          showSpinner: false
        },
        maxWidth: '90vw',
        maxHeight: '90vh',
        hasBackdrop: false,
        autoFocus: false
      });
    });
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
        hasBackdrop: false,
        autoFocus: false
      });
    }
    return undefined;
  }

  isShowAlways(url: string): boolean {
    return this.networkMessageMap.get(url)?.showAlways || false;
  }

  isOnline(): boolean {
    return this.online;
  }

  getErrorTitle(status: number): string {
    const key = this.errorTitleKeyMap[status] ?? 'errors.http.title.unexpected';
    return this.i18n.t(key);
  }

  getErrorIcon(status: number): string {
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
    const key = this.errorMessageKeyMap[status] ?? 'errors.http.message.unexpected';
    return this.i18n.t(key);
  }

}
