import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppSettings } from '../../../interfaces/app-settings';
import { AppService } from '../../../services/app.service';
import { EnableExternalContentComponent } from '../enable-external-content/enable-external-content.component';

export type AvatarSourceChoice = 'file' | 'unsplash';

@Component({
  selector: 'app-avatar-source-dialog',
  standalone: true,
  imports: [
    MatButtonModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    MatIcon,
    TranslocoPipe,
    EnableExternalContentComponent
  ],
  templateUrl: './avatar-source-dialog.component.html',
  styleUrl: './avatar-source-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AvatarSourceDialogComponent {
  private readonly appService = inject(AppService);
  private readonly dialogRef = inject(MatDialogRef<AvatarSourceDialogComponent>);

  showUnsplash = this.appService.getAppSettings().enableUnsplashContent;

  chooseFile(): void {
    this.dialogRef.close('file');
  }

  chooseUnsplash(): void {
    this.dialogRef.close('unsplash');
  }

  onEnabledChange(enabled: boolean): void {
    const current = this.appService.getAppSettings();
    const updated: AppSettings = { ...current, enableUnsplashContent: enabled };
    this.appService.setAppSettings(updated);
    this.showUnsplash = enabled;
  }
}
