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
import { AppSettings } from '../../../interfaces/app-settings';
import { AppService } from '../../../services/app.service';
import { AppSettingsComponent } from '../../app-settings/app-settings.component';
import { EnableExternalContentComponent } from '../../utils/enable-external-content/enable-external-content.component';

@Component({
  selector: 'app-external-content',
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
    EnableExternalContentComponent
  ],
  templateUrl: './external-content.component.html',
  styleUrl: './external-content.component.css'
})
export class ExternalContentComponent {

  public appSettings: AppSettings;
  constructor(
    private appService: AppService,
    private snackBar: MatSnackBar,
    public dialogRef: MatDialogRef<AppSettingsComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { appSettings: AppSettings }
  ) {
    this.appSettings = this.data.appSettings;
  }

  onCloseClick(): void {
    this.dialogRef.close();
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
