import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';

import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogContent, MatDialogModule, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { TranslocoPipe } from '@jsverse/transloco';
import { Contact } from '../../../interfaces/contact';
import { Place } from '../../../interfaces/place';
import { TileSetting, normalizeTileSettings } from '../../../interfaces/tile-settings';
import { ContactService } from '../../../services/contact.service';
import { TranslationHelperService } from '../../../services/translation-helper.service';
import { AnniversaryTileEditComponent } from '../anniversary-tile/anniversary-tile-edit/anniversary-tile-edit.component';
import { MigraineTileEditComponent } from '../migraine-tile/migraine-tile-edit/migraine-tile-edit.component';
import { MultitextTileEditComponent } from '../multitext-tile/multitext-tile-edit/multitext-tile-edit.component';
import { PollutionTileEditComponent } from '../pollution-tile/pollution-tile-edit/pollution-tile-edit.component';
import { QuickActionTileEditComponent } from '../quick-action-tile/quick-action-tile-edit/quick-action-tile-edit.component';
import { TextTileEditComponent } from '../text-tile/text-tile-edit/text-tile-edit.component';
import { TodoTileEditComponent } from '../todo-tile/todo-tile-edit/todo-tile-edit.component';
import { FileTileEditComponent } from '../file-tile/file-tile-edit/file-tile-edit.component';
import { TileDeleteComponent } from '../tile-delete/tile-delete.component';

@Component({
  selector: 'app-tile-settings',
  imports: [
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
    CdkDragHandle,
    TranslocoPipe
],
  templateUrl: './tile-settings.component.html',
  styleUrl: './tile-settings.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TileSettingsComponent {
  private readonly dialogRef = inject(MatDialogRef<TileSettingsComponent>);
  private readonly dialog = inject(MatDialog);
  private readonly contactService = inject(ContactService);
  private readonly translation = inject(TranslationHelperService);
  readonly data = inject<{ place?: Place; contact?: Contact }>(MAT_DIALOG_DATA);

  private readonly isPlaceContext = !!this.data.place;
  readonly tileSettings = signal<TileSetting[]>(normalizeTileSettings(
    this.data.place?.tileSettings ?? this.data.contact?.tileSettings,
    { includeDefaults: this.isPlaceContext, includeSystem: this.isPlaceContext }
  ).filter(tile => tile.type !== 'custom-link'));
  readonly addableTiles: { type: TileSetting['type']; labelKey: string; icon: string }[] = [
    { type: 'custom-text', labelKey: 'common.tileTypes.text', icon: 'text_fields' },
    { type: 'custom-multitext', labelKey: 'common.tileTypes.multitext', icon: 'notes' },
    { type: 'custom-date', labelKey: 'common.tileTypes.anniversary', icon: 'event' },
    { type: 'custom-todo', labelKey: 'common.tileTypes.todo', icon: 'check_circle' },
    { type: 'custom-quickaction', labelKey: 'common.tileTypes.quickActions', icon: 'bolt' },
    { type: 'custom-file', labelKey: 'common.tileTypes.files', icon: 'attach_file' }
  ];

  private readonly tileTypeLabelKeys: Partial<Record<TileSetting['type'], string>> = {
    datetime: 'common.tileTypes.datetime',
    weather: 'common.tileTypes.weather',
    airQuality: 'common.tileTypes.airQuality',
    note: 'common.tileTypes.note',
    message: 'common.tileTypes.message',
    image: 'common.tileTypes.image',
    'custom-text': 'common.tileTypes.text',
    'custom-multitext': 'common.tileTypes.multitext',
    'custom-date': 'common.tileTypes.anniversary',
    'custom-todo': 'common.tileTypes.todo',
    'custom-quickaction': 'common.tileTypes.quickActions',
    'custom-file': 'common.tileTypes.files',
    'custom-migraine': 'common.tileTypes.migraine',
    'custom-pollution': 'common.tileTypes.pollution'
  };

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

  addTile(tileToAdd: { type: TileSetting['type']; labelKey: string }) {
    const label = this.translation.t(tileToAdd.labelKey);
    const updated = [...this.tileSettings()];
    const id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `tile-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const baseTile: TileSetting = {
      id,
      type: tileToAdd.type,
      label,
      enabled: true,
      order: 0,
      custom: true,
      payload: {
        title: label,
        text: ''
      }
    };

    if (tileToAdd.type === 'custom-date') {
      baseTile.payload = {
        title: label,
        date: '',
        icon: 'event'
      };
    }

    if (tileToAdd.type === 'custom-todo') {
      baseTile.payload = {
        title: label,
        icon: 'list',
        todos: []
      };
    }

    if (tileToAdd.type === 'custom-quickaction') {
      baseTile.payload = {
        title: label,
        icon: 'bolt',
        actions: []
      };
    }

    if (tileToAdd.type === 'custom-file') {
      baseTile.payload = {
        title: label,
        icon: 'attach_file',
        files: []
      };
    }

    if (tileToAdd.type === 'custom-migraine') {
      return;
    }

    updated.unshift(baseTile);
    this.tileSettings.set(updated.map((tile, index) => ({ ...tile, order: index })));
    this.openEditorForTile(baseTile);
  }

  editTile(tile: TileSetting) {
    this.openEditorForTile(tile);
  }

  private openEditorForTile(tile: TileSetting) {
    if (tile.type === 'custom-text') {
      const ref = this.dialog.open(TextTileEditComponent, {
        width: '520px',
        data: { tile },
        hasBackdrop: true,
        backdropClass: 'dialog-backdrop-transparent',
        disableClose: true,
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
        data: { tile },
        hasBackdrop: true,
        backdropClass: 'dialog-backdrop-transparent',
        disableClose: true,
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
        minWidth: '450px',
        maxWidth: '95vw',
        height: 'auto',
        maxHeight: '95vh',
        autoFocus: false,
        data: { tile },
        hasBackdrop: true,
        backdropClass: 'dialog-backdrop-transparent',
        disableClose: true,
      });
      ref.afterClosed().subscribe((updated?: TileSetting) => {
        if (!updated) return;
        this.tileSettings.set(this.tileSettings().map(t => t.id === updated.id ? updated : t));
      });
      return;
    }

    if (tile.type === 'custom-todo') {
      const ref = this.dialog.open(TodoTileEditComponent, {
        width: '560px',
        maxWidth: '95vw',
        maxHeight: '98vh',
        data: { tile },
        hasBackdrop: true,
        backdropClass: 'dialog-backdrop-transparent',
        disableClose: true,
      });
      ref.afterClosed().subscribe((updated?: TileSetting) => {
        if (!updated) return;
        this.tileSettings.set(this.tileSettings().map(t => t.id === updated.id ? updated : t));
      });
      return;
    }

    if (tile.type === 'custom-quickaction') {
      const ref = this.dialog.open(QuickActionTileEditComponent, {
        width: '560px',
        maxWidth: '95vw',
        maxHeight: '98vh',
        data: { tile },
        hasBackdrop: true,
        backdropClass: 'dialog-backdrop-transparent',
        disableClose: true,
      });
      ref.afterClosed().subscribe((updated?: TileSetting) => {
        if (!updated) return;
        this.tileSettings.set(this.tileSettings().map(t => t.id === updated.id ? updated : t));
      });
      return;
    }

    if (tile.type === 'custom-file') {
      const ref = this.dialog.open(FileTileEditComponent, {
        width: '560px',
        maxWidth: '95vw',
        maxHeight: '98vh',
        data: { tile },
        hasBackdrop: true,
        backdropClass: 'dialog-backdrop-transparent',
        disableClose: true,
      });
      ref.afterClosed().subscribe((updated?: TileSetting) => {
        if (!updated) return;
        this.tileSettings.set(this.tileSettings().map(t => t.id === updated.id ? updated : t));
      });
      return;
    }

    if (tile.type === 'custom-pollution') {
      const ref = this.dialog.open(PollutionTileEditComponent, {
        panelClass: 'pollution-edit-dialog',
        width: 'min(520px, 95vw)',
        maxWidth: '95vw',
        maxHeight: '95vh',
        height: 'auto',
        data: { tile },
        hasBackdrop: true,
        backdropClass: 'dialog-backdrop-transparent',
        disableClose: true,
      });
      ref.afterClosed().subscribe((updated?: TileSetting) => {
        if (!updated) return;
        this.tileSettings.set(this.tileSettings().map(t => t.id === updated.id ? updated : t));
      });
      return;
    }

    if (tile.type === 'custom-migraine') {
      const ref = this.dialog.open(MigraineTileEditComponent, {
        width: '520px',
        data: { tile },
        hasBackdrop: true,
        backdropClass: 'dialog-backdrop-transparent',
        disableClose: true,
      });
      ref.afterClosed().subscribe((updated?: TileSetting) => {
        if (!updated) return;
        this.tileSettings.set(this.tileSettings().map(t => t.id === updated.id ? updated : t));
      });
      return;
    }

    const newLabel = prompt(this.translation.t('common.tileSettings.editLabelPrompt'), tile.label);
    if (newLabel && newLabel.trim()) {
      this.tileSettings.set(this.tileSettings().map(t => t.id === tile.id ? { ...t, label: newLabel.trim() } : t));
    }
  }

  deleteTile(tile: TileSetting) {
    if (tile.type === 'custom-migraine') {
      return;
    }
    const ref = this.dialog.open(TileDeleteComponent, {
      width: '360px',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop-transparent',
      disableClose: true,
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
    if (this.data.place) {
      this.data.place.tileSettings = normalized;
    }
    if (this.data.contact) {
      this.data.contact.tileSettings = normalized;
      this.contactService.saveContactTileSettings(this.data.contact);
    }
    this.dialogRef.close(normalized);
  }

  getTileLabel(tile: TileSetting): string {
    const key = this.tileTypeLabelKeys[tile.type];
    if (!tile.custom && key) {
      return this.translation.t(key);
    }
    if (tile.custom && tile.label?.trim()) {
      return tile.label;
    }
    return key ? this.translation.t(key) : tile.label;
  }

  trackTile = (_: number, tile: TileSetting) => tile.id;
}
