import { ChangeDetectionStrategy, Component, ViewChild, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { Contact } from '../../../interfaces/contact';
import { Place } from '../../../interfaces/place';
import { TranslationHelperService } from '../../../services/translation-helper.service';
import { HelpDialogService } from '../../utils/help-dialog/help-dialog.service';
import { TileListComponent } from '../tile-list/tile-list.component';

@Component({
  selector: 'app-tile-list-dialog',
  imports: [
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    MatButtonModule,
    MatIcon,
    TranslocoPipe,
    TileListComponent
  ],
  templateUrl: './tile-list-dialog.component.html',
  styleUrl: './tile-list-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TileListDialogComponent {
  private readonly translation = inject(TranslationHelperService);
  readonly help = inject(HelpDialogService);
  readonly data = inject<{ contact?: Contact; place?: Place }>(MAT_DIALOG_DATA);

  @ViewChild(TileListComponent) private tileList?: TileListComponent;

  get contact(): Contact | undefined {
    return this.data.contact;
  }

  get place(): Place | undefined {
    return this.data.place;
  }

  get tileSettingsAriaLabel(): string {
    if (this.contact) {
      const name = this.contact.name || this.translation.t('common.contact.profile.nameFallback');
      return this.translation.t('common.contact.profile.tileSettingsAria', { name });
    }

    const name = this.place?.name || this.translation.t('common.placeSettings.nameFallback');
    return this.translation.t('common.placeSettings.openTileSettingsAria', { name });
  }

  getPlaceHeaderBackgroundImage(): string {
    return this.place?.placeBackgroundImage ? `url(${this.place.placeBackgroundImage})` : 'none';
  }

  getPlaceHeaderBackgroundOpacity(): number {
    if (!this.place?.placeBackgroundImage) {
      return 0;
    }
    const transparency = this.place.placeBackgroundTransparency ?? 40;
    const clamped = Math.min(Math.max(transparency, 0), 100);
    return 1 - clamped / 100;
  }

  openTileSettings(): void {
    this.tileList?.openTileSettings();
  }
}
