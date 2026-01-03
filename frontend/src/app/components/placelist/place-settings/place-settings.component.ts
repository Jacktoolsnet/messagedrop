import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogModule, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';


import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoPipe } from '@jsverse/transloco';
import { Mode } from '../../../interfaces/mode';
import { Place } from '../../../interfaces/place';
import { TileSetting, normalizeTileSettings } from '../../../interfaces/tile-settings';
import { PlaceService } from '../../../services/place.service';
import { TranslationHelperService } from '../../../services/translation-helper.service';
import { TileSettingsComponent } from '../../tile/tile-settings/tile-settings.component';

@Component({
  selector: 'app-place',
  imports: [
    FormsModule,
    MatButtonModule,
    MatDialogActions,
    MatDialogClose,
    MatDialogTitle,
    MatDialogContent,
    MatDialogModule,
    MatIcon,
    MatFormFieldModule,
    MatInputModule,
    TranslocoPipe
  ],
  templateUrl: './place-settings.component.html',
  styleUrl: './place-settings.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PlaceProfileComponent {

  private maxFileSize = 5 * 1024 * 1024; // 5MB
  private oriName: string | undefined = undefined;
  private oriBase64Avatar: string | undefined = undefined;
  private oriIcon: string | undefined = undefined;
  private oriTileSettings: TileSetting[] | undefined = undefined;

  readonly dialogRef = inject(MatDialogRef<PlaceProfileComponent>);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translation = inject(TranslationHelperService);
  private readonly dialog = inject(MatDialog);
  private readonly placeService = inject(PlaceService);
  readonly data = inject<{ mode: Mode, place: Place }>(MAT_DIALOG_DATA);

  constructor() {
    this.oriName = this.data.place.name;
    this.oriBase64Avatar = this.data.place.base64Avatar;
    this.oriIcon = this.data.place.icon;
    const normalizedTileSettings = normalizeTileSettings(this.data.place.tileSettings);
    this.oriTileSettings = normalizedTileSettings.map((tile: TileSetting) => ({ ...tile }));
    this.data.place.tileSettings = normalizedTileSettings;
  }

  onApplyClick(): void {
    this.dialogRef.close();
  }

  onAbortClick(): void {
    if (undefined != this.oriName) {
      this.data.place.name = this.oriName;
    }
    if (undefined != this.oriBase64Avatar) {
      this.data.place.base64Avatar = this.oriBase64Avatar;
    }
    if (undefined != this.oriIcon) {
      this.data.place.icon = this.oriIcon;
    }
    if (this.oriTileSettings) {
      this.data.place.tileSettings = this.oriTileSettings.map(tile => ({ ...tile }));
    }
    this.dialogRef.close();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input?.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.snackBar.open(
        this.translation.t('common.placeSettings.imageInvalid'),
        this.translation.t('common.actions.ok'),
        { duration: 2000 }
      );
      return;
    }

    if (file.size > this.maxFileSize) {
      this.snackBar.open(
        this.translation.t('common.placeSettings.imageTooLarge'),
        this.translation.t('common.actions.ok'),
        { duration: 2000 }
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      this.data.place.base64Avatar = (e.target as FileReader).result as string;
    };
    reader.onerror = () => {
      this.snackBar.open(
        this.translation.t('common.placeSettings.imageReadError'),
        this.translation.t('common.actions.ok'),
        { duration: 2000 }
      );
    };

    reader.readAsDataURL(file);
  }

  deleteAvatar() {
    this.data.place.base64Avatar = '';
  }

  openTileSettings(): void {
    const dialogRef = this.dialog.open(TileSettingsComponent, {
      width: 'auto',
      minWidth: 'min(450px, 95vws',
      maxWidth: '90vw',
      maxHeight: '90vh',
      data: { place: this.data.place }
    });

    dialogRef.afterClosed().subscribe((updatedSettings?: TileSetting[]) => {
      if (updatedSettings?.length) {
        this.data.place.tileSettings = updatedSettings.map((tile: TileSetting) => ({ ...tile }));
        this.placeService.saveAdditionalPlaceInfos(this.data.place);
      }
    });
  }

  public showPolicy() {
    this.snackBar.open(
      this.translation.t('common.placeSettings.savePolicy'),
      this.translation.t('common.actions.ok'),
      {}
    );
  }

}
