import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatChipsModule } from '@angular/material/chips';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleChange, MatSlideToggleModule } from '@angular/material/slide-toggle';
import { APP_VERSION_INFO } from '../../../environments/version';
import { AppSettings } from '../../interfaces/app-settings';
import { AppService } from '../../services/app.service';
import { EnableLocationComponent } from "../utils/enable-location/enable-location.component";


@Component({
  selector: 'app-app-settings',
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    MatButtonToggleModule,
    MatChipsModule,
    MatSlideToggleModule,
    EnableLocationComponent
  ],
  templateUrl: './app-settings.component.html',
  styleUrl: './app-settings.component.css'
})
export class AppSettingsComponent implements OnInit {
  private readonly appService = inject(AppService);
  private readonly dialogRef = inject(MatDialogRef<AppSettingsComponent>);
  private readonly dialogData = inject<{ appSettings: AppSettings }>(MAT_DIALOG_DATA);

  public versionInfo = APP_VERSION_INFO;

  public availableThemes = [
    'azure',
    'blue',
    'chartreuse',
    'cyan',
    'green',
    'magenta',
    'orange',
    'red',
    'rose',
    'spring-green',
    'violet',
    'yellow'
  ];
  public appSettings: AppSettings = this.dialogData.appSettings;
  public showDetectLocationOnStart = false;
  public storagePersistenceSupported = this.appService.isStoragePersistenceSupported();
  public storagePersistenceBusy = false;
  public storagePersistenceWarning = '';

  ngOnInit(): void {
    if ('permissions' in navigator && navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'geolocation' })
        .then(result => {
          this.showDetectLocationOnStart = result.state === 'granted';
        })
        .catch(() => {
          this.showDetectLocationOnStart = false;
        });
    }
  }

  onCloseClick(): void {
    this.dialogRef.close();
  }

  setTheme(themeName: string): void {
    this.appSettings.defaultTheme = themeName;
    this.appService.setTheme(this.appSettings);
    this.appService.setAppSettings(this.appSettings);
  }

  setThemeMode(mode: 'light' | 'dark' | 'system') {
    this.appSettings.themeMode = mode;
    this.appService.setTheme(this.appSettings);
    this.appService.setAppSettings(this.appSettings);
  }

  setDetectLocationOnStart(enabled: boolean): void {
    this.appSettings = { ...this.appSettings, detectLocationOnStart: enabled };
    this.appService.setAppSettings(this.appSettings);
  }

  setBackupOnExit(enabled: boolean): void {
    this.appSettings = { ...this.appSettings, backupOnExit: enabled };
    this.appService.setAppSettings(this.appSettings);
  }

  async onStoragePersistenceToggle(event: MatSlideToggleChange): Promise<void> {
    if (!this.storagePersistenceSupported) {
      event.source.checked = false;
      return;
    }

    const targetState = event.checked;
    const previousState = this.appSettings.persistStorage ?? false;

    if (!targetState) {
      const confirmed = typeof window === 'undefined'
        ? true
        : window.confirm('Disabling may allow the browser to prune stored data. Do you really want to continue?');
      if (!confirmed) {
        event.source.checked = previousState;
        return;
      }
    }

    this.storagePersistenceBusy = true;

    try {
      const granted = await this.appService.updateStoragePersistencePreference(targetState);
      this.appSettings = { ...this.appSettings, persistStorage: granted };
      if (targetState && !granted) {
        console.warn('Persistent storage could not be granted by the browser.');
      }
    } finally {
      this.storagePersistenceBusy = false;
      event.source.checked = this.appSettings.persistStorage;
      if (targetState && !this.appSettings.persistStorage) {
        this.storagePersistenceWarning = 'Persistent storage could not be granted by the browser.';
      } else {
        this.storagePersistenceWarning = '';
      }
    }
  }

}
