import { Injectable } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { DisplayMessage } from '../components/utils/display-message/display-message.component';

@Injectable({
  providedIn: 'root'
})
export class NetworkService {

  private networkDialogRef: MatDialogRef<DisplayMessage> | undefined;

  constructor(private displayMessage: MatDialog) { }

  online: boolean = true;

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

  isOnline(): boolean {
    return this.online;
  }

}
