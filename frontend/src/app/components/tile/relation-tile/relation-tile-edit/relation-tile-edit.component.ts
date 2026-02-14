import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogContent, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { TranslocoPipe } from '@jsverse/transloco';
import { Contact } from '../../../../interfaces/contact';
import { Place } from '../../../../interfaces/place';
import { TileSetting } from '../../../../interfaces/tile-settings';
import { ContactService } from '../../../../services/contact.service';
import { PlaceService } from '../../../../services/place.service';
import { TranslationHelperService } from '../../../../services/translation-helper.service';
import { DialogHeaderComponent } from '../../../utils/dialog-header/dialog-header.component';
import { HelpDialogService } from '../../../utils/help-dialog/help-dialog.service';
import {
  TileDisplaySettingsDialogComponent,
  TileDisplaySettingsDialogData,
  TileDisplaySettingsDialogResult
} from '../../tile-display-settings-dialog/tile-display-settings-dialog.component';

type RelationMode = 'placeContacts' | 'contactPlaces';

interface RelationDialogItem {
  id: string;
  name: string;
  avatarUrl?: string;
  avatarAlt: string;
  fallbackIcon: string;
}

export interface RelationTileEditDialogData {
  tile: TileSetting;
  place?: Place;
  contact?: Contact;
  onTileCommit?: (updated: TileSetting) => void;
}

@Component({
  selector: 'app-relation-tile-edit',
  standalone: true,
  imports: [
    DialogHeaderComponent,
    MatDialogModule,
    MatDialogContent,
    MatDialogActions,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIcon,
    MatSlideToggleModule,
    TranslocoPipe
  ],
  templateUrl: './relation-tile-edit.component.html',
  styleUrl: './relation-tile-edit.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RelationTileEditComponent {
  private readonly dialogRef = inject(MatDialogRef<RelationTileEditComponent>);
  private readonly dialog = inject(MatDialog);
  private readonly contactService = inject(ContactService);
  private readonly placeService = inject(PlaceService);
  private readonly translation = inject(TranslationHelperService);
  readonly help = inject(HelpDialogService);
  readonly data = inject<RelationTileEditDialogData>(MAT_DIALOG_DATA);

  readonly mode: RelationMode = this.resolveMode();
  readonly fallbackTitle = this.translation.t(this.mode === 'placeContacts' ? 'common.tileTypes.placeContacts' : 'common.tileTypes.contactPlaces');
  readonly title = signal(
    (this.data.tile.payload?.title ?? (this.data.tile.custom ? this.data.tile.label : '') ?? this.fallbackTitle).trim() || this.fallbackTitle
  );
  readonly icon = signal<string | undefined>(this.data.tile.payload?.icon ?? (this.mode === 'placeContacts' ? 'group' : 'place'));
  readonly filterValue = signal('');
  readonly selectedIds = signal<Set<string>>(new Set(this.initialSelectedIds()));
  readonly items = this.buildItems();

  get headerTitle(): string {
    return this.title().trim() || this.fallbackTitle;
  }

  get headerIcon(): string {
    return this.icon() || (this.mode === 'placeContacts' ? 'group' : 'place');
  }

  get filterPlaceholderKey(): string {
    return this.mode === 'placeContacts'
      ? 'common.tiles.relations.filterContactsPlaceholder'
      : 'common.tiles.relations.filterPlacesPlaceholder';
  }

  get filteredItems(): RelationDialogItem[] {
    const filter = this.filterValue().trim().toLocaleLowerCase();
    if (!filter) {
      return this.items;
    }
    return this.items.filter((item) => item.name.toLocaleLowerCase().includes(filter));
  }

  onFilterInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.filterValue.set(value);
  }

  clearFilter(): void {
    this.filterValue.set('');
  }

  toggleItem(id: string, checked: boolean): void {
    const next = new Set(this.selectedIds());
    if (checked) {
      next.add(id);
    } else {
      next.delete(id);
    }
    this.selectedIds.set(next);
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
      this.title.set(result.title);
      this.icon.set(result.icon);
      this.commitDisplaySettings();
    });
  }

  cancel(): void {
    this.dialogRef.close();
  }

  save(): void {
    const updated = this.buildUpdatedTile(this.getOrderedSelectedIds());
    this.dialogRef.close(updated);
  }

  trackByItem = (_: number, item: RelationDialogItem) => item.id;

  private resolveMode(): RelationMode {
    if (this.data.tile.type === 'placeContacts' || this.data.tile.type === 'contactPlaces') {
      return this.data.tile.type;
    }
    return this.data.place ? 'placeContacts' : 'contactPlaces';
  }

  private initialSelectedIds(): string[] {
    if (this.mode === 'placeContacts') {
      return this.normalizeIds(this.data.tile.payload?.relatedContactIds);
    }
    return this.normalizeIds(this.data.tile.payload?.relatedPlaceIds);
  }

  private getOrderedSelectedIds(): string[] {
    const selected = this.selectedIds();
    return this.items
      .filter((item) => selected.has(item.id))
      .map((item) => item.id);
  }

  private buildItems(): RelationDialogItem[] {
    if (this.mode === 'placeContacts') {
      return this.contactService.sortedContactsSignal().map((entry) => {
        const name = entry.name?.trim() || this.translation.t('common.contact.list.nameFallback');
        return {
          id: entry.id,
          name,
          avatarUrl: entry.base64Avatar,
          avatarAlt: entry.name
            ? this.translation.t('common.contact.profile.avatarAltName', { name: entry.name })
            : this.translation.t('common.contact.profile.avatarAlt'),
          fallbackIcon: 'person'
        };
      });
    }

    return this.placeService.sortedPlacesSignal().map((entry) => {
      const name = entry.name?.trim() || this.translation.t('common.placeList.nameFallback');
      return {
        id: entry.id,
        name,
        avatarUrl: entry.base64Avatar,
        avatarAlt: entry.name
          ? this.translation.t('common.placeList.avatarAltName', { name: entry.name })
          : this.translation.t('common.placeList.avatarAltFallback'),
        fallbackIcon: entry.icon || 'place'
      };
    });
  }

  private buildUpdatedTile(relatedIds: string[]): TileSetting {
    const title = this.headerTitle;
    const payload = {
      ...this.data.tile.payload,
      title,
      icon: this.icon()
    };

    if (this.mode === 'placeContacts') {
      return {
        ...this.data.tile,
        label: title,
        payload: {
          ...payload,
          relatedContactIds: relatedIds
        }
      };
    }

    return {
      ...this.data.tile,
      label: title,
      payload: {
        ...payload,
        relatedPlaceIds: relatedIds
      }
    };
  }

  private commitDisplaySettings(): void {
    const updated = this.buildUpdatedTile(this.initialSelectedIds());
    this.data.tile = updated;
    this.data.onTileCommit?.(updated);
  }

  private normalizeIds(ids: string[] | undefined): string[] {
    return Array.from(new Set((ids ?? []).filter((id) => !!id)));
  }
}
