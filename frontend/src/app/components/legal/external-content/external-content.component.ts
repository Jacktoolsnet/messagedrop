
import { Component, inject } from '@angular/core';
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
import { TranslocoPipe } from '@jsverse/transloco';
import { AppSettings } from '../../../interfaces/app-settings';
import { AppService } from '../../../services/app.service';
import { EnableExternalContentComponent } from '../../utils/enable-external-content/enable-external-content.component';
import { HelpDialogService } from '../../utils/help-dialog/help-dialog.service';

@Component({
  selector: 'app-external-content',
  imports: [
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
    TranslocoPipe
],
  templateUrl: './external-content.component.html',
  styleUrl: './external-content.component.css'
})
export class ExternalContentComponent {

  private readonly appService = inject(AppService);
  private readonly dialogRef = inject(MatDialogRef<ExternalContentComponent>);
  private readonly dialogData = inject<{ appSettings: AppSettings }>(MAT_DIALOG_DATA);
  readonly help = inject(HelpDialogService);

  public appSettings: AppSettings = structuredClone(this.dialogData.appSettings);

  onCloseClick(): void {
    this.dialogRef.close();
  }

  async onApplyClick(): Promise<void> {
    await this.appService.setAppSettings(this.appSettings);
    this.dialogRef.close();
  }

  setAllowYoutubeContent(enabled: boolean): void {
    this.appSettings = { ...this.appSettings, enableYoutubeContent: enabled };
  }

  setAllowPinterestContent(enabled: boolean): void {
    this.appSettings = { ...this.appSettings, enablePinterestContent: enabled };
  }

  setAllowSpotifyContent(enabled: boolean): void {
    this.appSettings = { ...this.appSettings, enableSpotifyContent: enabled };
  }

  setAllowTikTokContent(enabled: boolean): void {
    this.appSettings = { ...this.appSettings, enableTikTokContent: enabled };
  }

  setAllowTenorContent(enabled: boolean): void {
    this.appSettings = { ...this.appSettings, enableTenorContent: enabled };
  }

  setAllowUnsplashContent(enabled: boolean): void {
    this.appSettings = { ...this.appSettings, enableUnsplashContent: enabled };
  }

}
