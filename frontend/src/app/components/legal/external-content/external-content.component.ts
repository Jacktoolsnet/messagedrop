
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppSettings } from '../../../interfaces/app-settings';
import {
  ExternalContentPlatform,
  EXTERNAL_CONTENT_PLATFORMS,
  EXTERNAL_CONTENT_SETTINGS_KEYS
} from '../../../interfaces/external-content-platform';
import { AppService } from '../../../services/app.service';
import { EnableExternalContentComponent } from '../../utils/enable-external-content/enable-external-content.component';
import { HelpDialogService } from '../../utils/help-dialog/help-dialog.service';
import { DialogHeaderComponent } from '../../utils/dialog-header/dialog-header.component';

interface ExternalContentDialogData {
  appSettings: AppSettings;
  visiblePlatforms?: ExternalContentPlatform[];
}

@Component({
  selector: 'app-external-content',
  imports: [
    DialogHeaderComponent,
    MatButtonModule,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    MatIconModule,
    EnableExternalContentComponent,
    TranslocoPipe
  ],
  templateUrl: './external-content.component.html',
  styleUrl: './external-content.component.css'
})
export class ExternalContentComponent {

  private readonly appService = inject(AppService);
  private readonly dialogRef = inject(MatDialogRef<ExternalContentComponent>);
  private readonly dialogData = inject<ExternalContentDialogData>(MAT_DIALOG_DATA);
  readonly help = inject(HelpDialogService);

  public appSettings: AppSettings = structuredClone(this.dialogData.appSettings);
  readonly visiblePlatforms = this.getVisiblePlatforms(this.dialogData.visiblePlatforms);
  readonly isSinglePlatformView = this.visiblePlatforms.length === 1;

  onCloseClick(): void {
    this.dialogRef.close();
  }

  async onApplyClick(): Promise<void> {
    await this.appService.setAppSettings(this.appSettings);
    this.dialogRef.close();
  }

  isPlatformEnabled(platform: ExternalContentPlatform): boolean {
    return this.appSettings[EXTERNAL_CONTENT_SETTINGS_KEYS[platform]];
  }

  setPlatformEnabled(platform: ExternalContentPlatform, enabled: boolean): void {
    const settingsKey = EXTERNAL_CONTENT_SETTINGS_KEYS[platform];
    this.appSettings = { ...this.appSettings, [settingsKey]: enabled } as AppSettings;
  }

  private getVisiblePlatforms(platforms?: ExternalContentPlatform[]): readonly ExternalContentPlatform[] {
    if (!platforms?.length) {
      return EXTERNAL_CONTENT_PLATFORMS;
    }

    const requestedPlatforms = new Set(platforms);
    const visiblePlatforms = EXTERNAL_CONTENT_PLATFORMS.filter((platform) => requestedPlatforms.has(platform));

    return visiblePlatforms.length > 0 ? visiblePlatforms : EXTERNAL_CONTENT_PLATFORMS;
  }

}
