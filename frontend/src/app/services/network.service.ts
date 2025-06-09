import { Injectable } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { DisplayMessage } from '../components/utils/display-message/display-message.component';
import { DisplayMessageConfig } from '../interfaces/display-message-config';

@Injectable({
  providedIn: 'root'
})
export class NetworkService {

  private networkDialogRef: MatDialogRef<DisplayMessage> | undefined;

  constructor(private displayMessage: MatDialog) { }

  online: boolean = true;
  private networkMessageMap = new Map<string, DisplayMessageConfig>();

  init() {
    window.addEventListener('online', () => {
      this.online = true;
      this.networkDialogRef?.close()
    });
    window.addEventListener('offline', () => {
      this.online = false;
      this.networkDialogRef = this.displayMessage?.open(DisplayMessage, {
        panelClass: '',
        closeOnNavigation: false,
        data: {
          showAlways: true,
          title: 'Oops! You are offline..',
          image: '',
          icon: '',
          message: `Apparently, your network needed some “me time”.`,
          button: '',
          delay: 0,
          showSpinner: false
        },
        maxWidth: '90vw',
        maxHeight: '90vh',
        hasBackdrop: false,
        autoFocus: false
      });

      this.networkDialogRef?.afterOpened().subscribe(e => { });

      this.networkDialogRef?.afterClosed().subscribe(() => { });
    });
  }

  isSlowConnection(): boolean {
    const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;

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
      return this.displayMessage?.open(DisplayMessage, {
        panelClass: '',
        closeOnNavigation: false,
        data: this.networkMessageMap.get(url),
        maxWidth: '90vw',
        maxHeight: '90vh',
        hasBackdrop: false,
        autoFocus: false
      });
    } else {
      return undefined
    }
  }

  isShowAlways(url: string): boolean {
    return this.networkMessageMap.get(url)?.showAlways || false;
  }

  isOnline(): boolean {
    return this.online;
  }

  getErrorTitle(status: number): string {
    switch (status) {
      case 0: return 'No Connection';
      case 400: return 'Bad Request';
      case 401: return 'Unauthorized';
      case 403: return 'Forbidden';
      case 404: return 'Not Found';
      case 408: return 'Request Timeout';
      case 429: return 'Too Many Requests';
      case 500: return 'Server Error';
      case 502: return 'Bad Gateway';
      case 503: return 'Service Unavailable';
      case 504: return 'Gateway Timeout';
      default: return 'Unexpected Error';
    }
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
    switch (status) {
      case 0: return 'Please check your internet connection.';
      case 400: return 'The request could not be processed.';
      case 401: return 'You need to sign in to continue.';
      case 403: return 'You are not allowed to access this resource.';
      case 404: return 'The requested resource was not found.';
      case 408: return 'The request took too long to complete.';
      case 429: return 'You sent too many requests. Please wait a moment.';
      case 500: return 'An unexpected server error occurred.';
      case 502: return 'The server received an invalid response.';
      case 503: return 'The service is temporarily unavailable.';
      case 504: return 'The server took too long to respond.';
      default: return 'Something went wrong. Please try again later.';
    }
  }

}
