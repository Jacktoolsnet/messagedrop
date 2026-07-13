import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Observable, map, of } from 'rxjs';
import { ExternalContentComponent } from '../components/legal/external-content/external-content.component';
import { ExternalContentPlatform, EXTERNAL_CONTENT_SETTINGS_KEYS } from '../interfaces/external-content-platform';
import { AppService } from './app.service';

@Injectable({ providedIn: 'root' })
export class ExternalContentConsentService {
  private readonly appService = inject(AppService);
  private readonly dialog = inject(MatDialog);

  isEnabled(platform: ExternalContentPlatform): boolean {
    return Boolean(this.appService.getAppSettings()[EXTERNAL_CONTENT_SETTINGS_KEYS[platform]]);
  }

  request(platform: ExternalContentPlatform): Observable<boolean> {
    if (this.isEnabled(platform)) {
      return of(true);
    }
    const dialogRef = this.dialog.open(ExternalContentComponent, {
      data: {
        appSettings: this.appService.getAppSettings(),
        visiblePlatforms: [platform]
      },
      width: 'min(440px, 90vw)',
      maxWidth: '90vw',
      maxHeight: '90vh',
      height: 'auto',
      autoFocus: false,
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false
    });
    return dialogRef.afterClosed().pipe(map(() => this.isEnabled(platform)));
  }
}
