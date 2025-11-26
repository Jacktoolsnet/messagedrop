import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogModule, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { Place } from '../../../interfaces/place';
import { TileSetting, normalizeTileSettings } from '../../../interfaces/tile-settings';

@Component({
  selector: 'app-tile-settings',
  imports: [
    CommonModule,
    MatButtonModule,
    MatDialogActions,
    MatDialogContent,
    MatDialogTitle,
    MatDialogModule,
    MatIcon,
    MatSlideToggleModule,
    CdkDrag,
    CdkDropList,
    CdkDragHandle
  ],
  templateUrl: './tile-settings.component.html',
  styleUrl: './tile-settings.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TileSettingsComponent {
  private readonly dialogRef = inject(MatDialogRef<TileSettingsComponent>);
  readonly data = inject<{ place: Place }>(MAT_DIALOG_DATA);

  readonly tileSettings = signal<TileSetting[]>(normalizeTileSettings(this.data.place.tileSettings));

  drop(event: CdkDragDrop<TileSetting[]>) {
    const updated = [...this.tileSettings()];
    moveItemInArray(updated, event.previousIndex, event.currentIndex);
    this.tileSettings.set(updated.map((tile: TileSetting, index: number) => ({ ...tile, order: index })));
  }

  toggleTile(tile: TileSetting, enabled: boolean) {
    const updated = this.tileSettings().map((setting: TileSetting) =>
      setting.type === tile.type ? { ...setting, enabled } : setting
    );
    this.tileSettings.set(updated);
  }

  close() {
    this.dialogRef.close();
  }

  save() {
    const normalized = this.tileSettings().map((tile: TileSetting, index: number) => ({ ...tile, order: index }));
    this.data.place.tileSettings = normalized;
    this.dialogRef.close(normalized);
  }

  trackTile = (_: number, tile: TileSetting) => tile.type;
}
