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
        hasBackdrop: false
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
        hasBackdrop: false
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

}
