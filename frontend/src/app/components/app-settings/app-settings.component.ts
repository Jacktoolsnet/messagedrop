import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatChipsModule } from '@angular/material/chips';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { APP_VERSION_INFO } from '../../../environments/version';
import { AppSettings } from '../../interfaces/app-settings';
import { AppService } from '../../services/app.service';
import { EnableExternalContentComponent } from '../utils/enable-external-content/enable-external-content.component';
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
    EnableExternalContentComponent,
    EnableLocationComponent
  ],
  templateUrl: './app-settings.component.html',
  styleUrl: './app-settings.component.css'
})
export class AppSettingsComponent {
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
  public appSettings: AppSettings;
  public showDetectLocationOnStart: boolean = false;

  constructor(
    private appService: AppService,
    private snackBar: MatSnackBar,
    public dialogRef: MatDialogRef<AppSettingsComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { appSettings: AppSettings }
  ) {
    this.appSettings = this.data.appSettings;
    navigator.permissions.query({ name: 'geolocation' }).then((result) => {
      this.showDetectLocationOnStart = result.state === 'granted';
    });
  }

  onAbortClick(): void {
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

  setAllowYoutubeContent(enabled: boolean): void {
    this.appSettings = { ...this.appSettings, enableYoutubeContent: enabled };
    this.appService.setAppSettings(this.appSettings);
  }

  setAllowPinterestContent(enabled: boolean): void {
    this.appSettings = { ...this.appSettings, enablePinterestContent: enabled };
    this.appService.setAppSettings(this.appSettings);
  }

  setAllowSpotifyContent(enabled: boolean): void {
    this.appSettings = { ...this.appSettings, enableSpotifyContent: enabled };
    this.appService.setAppSettings(this.appSettings);
  }

  setAllowTikTokContent(enabled: boolean): void {
    this.appSettings = { ...this.appSettings, enableTikTokContent: enabled };
    this.appService.setAppSettings(this.appSettings);
  }

  setAllowTenorContent(enabled: boolean): void {
    this.appSettings = { ...this.appSettings, enableTenorContent: enabled };
    this.appService.setAppSettings(this.appSettings);
  }

}
