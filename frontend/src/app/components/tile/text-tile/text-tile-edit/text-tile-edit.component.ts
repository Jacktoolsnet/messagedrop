import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { A11yModule } from '@angular/cdk/a11y';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogContent, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import { TileSetting } from '../../../../interfaces/tile-settings';
import { TranslationHelperService } from '../../../../services/translation-helper.service';
import { HelpDialogService } from '../../../utils/help-dialog/help-dialog.service';
import { DialogHeaderComponent } from '../../../utils/dialog-header/dialog-header.component';
import {
  TileDisplaySettingsDialogComponent,
  TileDisplaySettingsDialogData,
  TileDisplaySettingsDialogResult
} from '../../tile-display-settings-dialog/tile-display-settings-dialog.component';

interface TextTileDialogData {
  tile: TileSetting;
  onTileCommit?: (updated: TileSetting) => void;
}

@Component({
  selector: 'app-text-tile-edit',
  standalone: true,
  imports: [
    DialogHeaderComponent,
    ReactiveFormsModule,
    MatDialogModule,
    MatDialogContent,
    MatDialogActions,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIcon,
    A11yModule,
    TranslocoPipe
  ],
  templateUrl: './text-tile-edit.component.html',
  styleUrl: './text-tile-edit.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TextTileEditComponent {
  private readonly dialogRef = inject(MatDialogRef<TextTileEditComponent>);
  private readonly dialog = inject(MatDialog);
  private readonly translation = inject(TranslationHelperService);
  readonly help = inject(HelpDialogService);
  readonly data = inject<TextTileDialogData>(MAT_DIALOG_DATA);
  private readonly fallbackTitle = this.translation.t('common.tileTypes.text');

  readonly titleControl = new FormControl(
    this.data.tile.payload?.title ?? this.data.tile.label ?? this.fallbackTitle,
    { nonNullable: true }
  );
  readonly textControl = new FormControl(this.data.tile.payload?.text ?? '', { nonNullable: true });
  readonly icon = signal<string | undefined>(this.data.tile.payload?.icon);

  get headerTitle(): string {
    return this.titleControl.value.trim() || this.fallbackTitle;
  }

  get headerIcon(): string {
    return this.icon() || 'text_fields';
  }

  openDisplaySettings(): void {
    const ref = this.dialog.open<TileDisplaySettingsDialogComponent, TileDisplaySettingsDialogData, TileDisplaySettingsDialogResult | undefined>(
      TileDisplaySettingsDialogComponent,
      {
        width: '460px',
        maxWidth: '95vw',
        data: {
          title: this.headerTitle,
          icon: this.icon(),
          fallbackTitle: this.fallbackTitle,
          dialogTitleKey: 'common.tileEdit.displaySettingsTitle'
        },
        hasBackdrop: true,
        backdropClass: 'dialog-backdrop',
        disableClose: false,
      }
    );

    ref.afterClosed().subscribe((result) => {
      if (!result) {
        return;
      }
      this.titleControl.setValue(result.title);
      this.icon.set(result.icon);
      this.commitDisplaySettings();
    });
  }

  cancel(): void {
    this.dialogRef.close();
  }

  save(): void {
    const updated = this.buildUpdatedTile();
    this.dialogRef.close(updated);
  }

  private commitDisplaySettings(): void {
    const title = this.titleControl.value.trim() || this.fallbackTitle;
    const updated: TileSetting = {
      ...this.data.tile,
      label: title,
      payload: {
        ...this.data.tile.payload,
        title,
        icon: this.icon()
      }
    };
    this.data.tile = updated;
    this.data.onTileCommit?.(updated);
  }

  private buildUpdatedTile(): TileSetting {
    const title = this.titleControl.value.trim() || this.fallbackTitle;
    const text = this.textControl.value;
    return {
      ...this.data.tile,
      label: title,
      payload: {
        ...this.data.tile.payload,
        title,
        text,
        icon: this.icon()
      }
    };
  }
}
