import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogContent, MatDialogModule, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { Place } from '../../../interfaces/place';
import { TileSetting, normalizeTileSettings } from '../../../interfaces/tile-settings';
import { AnniversaryTileEditComponent } from '../anniversary-tile/anniversary-tile-edit/anniversary-tile-edit.component';
import { LinkTileEditComponent } from '../link-tile/link-tile-edit/link-tile-edit.component';
import { MultitextTileEditComponent } from '../multitext-tile/multitext-tile-edit/multitext-tile-edit.component';
import { TextTileEditComponent } from '../text-tile/text-tile-edit/text-tile-edit.component';
import { TileDeleteComponent } from '../tile-delete/tile-delete.component';

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
    MatMenuModule,
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
  private readonly dialog = inject(MatDialog);
  readonly data = inject<{ place: Place }>(MAT_DIALOG_DATA);

  readonly tileSettings = signal<TileSetting[]>(normalizeTileSettings(this.data.place.tileSettings));
  readonly addableTiles: { type: TileSetting['type']; label: string; icon: string }[] = [
    { type: 'custom-text', label: 'Text', icon: 'text_fields' },
    { type: 'custom-multitext', label: 'Multitext', icon: 'notes' },
    { type: 'custom-date', label: 'Anniversary', icon: 'event' },
    { type: 'custom-link', label: 'Link', icon: 'link' }
  ];

  drop(event: CdkDragDrop<TileSetting[]>) {
    const updated = [...this.tileSettings()];
    moveItemInArray(updated, event.previousIndex, event.currentIndex);
    this.tileSettings.set(updated.map((tile: TileSetting, index: number) => ({ ...tile, order: index })));
  }

  toggleTile(tile: TileSetting, enabled: boolean) {
    const updated = this.tileSettings().map((setting: TileSetting) =>
      setting.id === tile.id ? { ...setting, enabled } : setting
    );
    this.tileSettings.set(updated);
  }

  addTile(tileToAdd: { type: TileSetting['type']; label: string }) {
    const updated = [...this.tileSettings()];
    const id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `tile-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const baseTile: TileSetting = {
      id,
      type: tileToAdd.type,
      label: tileToAdd.label,
      enabled: true,
      order: updated.length,
      custom: true,
      payload: {
        title: tileToAdd.label,
        text: ''
      }
    };

    if (tileToAdd.type === 'custom-date') {
      baseTile.payload = {
        title: tileToAdd.label,
        date: '',
        icon: 'event'
      };
    }

    if (tileToAdd.type === 'custom-link') {
      baseTile.payload = {
        title: tileToAdd.label,
        url: '',
        icon: 'link',
        linkType: 'web'
      };
    }

    updated.push(baseTile);
    this.tileSettings.set(updated.map((tile, index) => ({ ...tile, order: index })));
  }

  editTile(tile: TileSetting) {
    if (tile.type === 'custom-text') {
      const ref = this.dialog.open(TextTileEditComponent, {
        width: '520px',
        data: { tile }
      });
      ref.afterClosed().subscribe((updated?: TileSetting) => {
        if (!updated) return;
        this.tileSettings.set(this.tileSettings().map(t => t.id === updated.id ? updated : t));
      });
      return;
    }

    if (tile.type === 'custom-multitext') {
      const ref = this.dialog.open(MultitextTileEditComponent, {
        width: '520px',
        data: { tile }
      });
      ref.afterClosed().subscribe((updated?: TileSetting) => {
        if (!updated) return;
        this.tileSettings.set(this.tileSettings().map(t => t.id === updated.id ? updated : t));
      });
      return;
    }

    if (tile.type === 'custom-date') {
      const ref = this.dialog.open(AnniversaryTileEditComponent, {
        width: 'auto',
        maxWidth: '95vw',
        height: 'auto',
        maxHeight: '90vh',
        panelClass: 'TileEditDialog',
        data: { tile }
      });
      ref.afterClosed().subscribe((updated?: TileSetting) => {
        if (!updated) return;
        this.tileSettings.set(this.tileSettings().map(t => t.id === updated.id ? updated : t));
      });
      return;
    }

    if (tile.type === 'custom-link') {
      const ref = this.dialog.open(LinkTileEditComponent, {
        width: '520px',
        data: { tile }
      });
      ref.afterClosed().subscribe((updated?: TileSetting) => {
        if (!updated) return;
        this.tileSettings.set(this.tileSettings().map(t => t.id === updated.id ? updated : t));
      });
      return;
    }

    const newLabel = prompt('Tile-Bezeichnung bearbeiten', tile.label);
    if (newLabel && newLabel.trim()) {
      this.tileSettings.set(this.tileSettings().map(t => t.id === tile.id ? { ...t, label: newLabel.trim() } : t));
    }
  }

  deleteTile(tile: TileSetting) {
    const ref = this.dialog.open(TileDeleteComponent, {
      width: '360px'
    });
    ref.afterClosed().subscribe(result => {
      if (!result) return;
      this.tileSettings.set(this.tileSettings()
        .filter(t => t.id !== tile.id)
        .map((t, index) => ({ ...t, order: index })));
    });
  }

  close() {
    this.dialogRef.close();
  }

  save() {
    const normalized = this.tileSettings().map((tile: TileSetting, index: number) => ({ ...tile, order: index }));
    this.data.place.tileSettings = normalized;
    this.dialogRef.close(normalized);
  }

  trackTile = (_: number, tile: TileSetting) => tile.id;
}
