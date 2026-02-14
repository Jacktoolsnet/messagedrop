import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnChanges, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { Contact } from '../../../interfaces/contact';
import { Place } from '../../../interfaces/place';
import { TileSetting, normalizeTileSettings } from '../../../interfaces/tile-settings';
import { ContactService } from '../../../services/contact.service';
import { PlaceService } from '../../../services/place.service';
import { TranslationHelperService } from '../../../services/translation-helper.service';
import { RelationTileEditComponent } from './relation-tile-edit/relation-tile-edit.component';

type RelationMode = 'placeContacts' | 'contactPlaces';

interface RelationListItem {
  id: string;
  name: string;
  avatarUrl?: string;
  avatarAlt: string;
  fallbackIcon: string;
}

@Component({
  selector: 'app-relation-tile',
  standalone: true,
  imports: [MatIcon, MatButtonModule, TranslocoPipe],
  templateUrl: './relation-tile.component.html',
  styleUrl: './relation-tile.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RelationTileComponent implements OnChanges {
  @Input() tile!: TileSetting;
  @Input() place?: Place;
  @Input() contact?: Contact;

  private readonly dialog = inject(MatDialog);
  private readonly placeService = inject(PlaceService);
  private readonly contactService = inject(ContactService);
  private readonly translation = inject(TranslationHelperService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly currentTile = signal<TileSetting | null>(null);

  ngOnChanges(): void {
    this.currentTile.set(this.tile);
  }

  get title(): string {
    const tile = this.currentTile();
    const fallback = this.translation.t(this.mode === 'placeContacts' ? 'common.tileTypes.placeContacts' : 'common.tileTypes.contactPlaces');
    if (!tile) {
      return fallback;
    }
    return tile.payload?.title?.trim() || (tile.custom ? (tile.label?.trim() || fallback) : fallback);
  }

  get icon(): string {
    const fallbackIcon = this.mode === 'placeContacts' ? 'group' : 'place';
    return this.currentTile()?.payload?.icon || fallbackIcon;
  }

  get emptyTextKey(): string {
    return this.mode === 'placeContacts'
      ? 'common.tiles.relations.emptyPlaceContacts'
      : 'common.tiles.relations.emptyContactPlaces';
  }

  get linkedItems(): RelationListItem[] {
    const tile = this.currentTile();
    if (!tile) {
      return [];
    }

    if (this.mode === 'placeContacts') {
      const ids = tile.payload?.relatedContactIds ?? [];
      const contacts = this.contactService.contactsSignal();
      const byId = new Map(contacts.map((entry) => [entry.id, entry]));
      return ids
        .map((id) => byId.get(id))
        .filter((entry): entry is Contact => !!entry)
        .map((entry) => {
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

    const ids = tile.payload?.relatedPlaceIds ?? [];
    const places = this.placeService.getPlaces();
    const byId = new Map(places.map((entry) => [entry.id, entry]));
    return ids
      .map((id) => byId.get(id))
      .filter((entry): entry is Place => !!entry)
      .map((entry) => {
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

  editRelations(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();

    const tile = this.currentTile();
    if (!tile) {
      return;
    }

    const ref = this.dialog.open(RelationTileEditComponent, {
      width: 'min(620px, 95vw)',
      maxWidth: '95vw',
      maxHeight: '95vh',
      height: 'auto',
      autoFocus: false,
      data: {
        tile,
        place: this.place,
        contact: this.contact,
        onTileCommit: (updated: TileSetting) => this.applyTileUpdate(updated)
      },
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
    });

    ref.afterClosed().subscribe((updated?: TileSetting) => {
      if (!updated) {
        return;
      }
      this.applyTileUpdate(updated);
    });
  }

  trackByItem = (_: number, item: RelationListItem) => item.id;

  private get mode(): RelationMode {
    const tileType = this.currentTile()?.type;
    if (tileType === 'placeContacts' || tileType === 'contactPlaces') {
      return tileType;
    }
    return this.place ? 'placeContacts' : 'contactPlaces';
  }

  private applyTileUpdate(updated: TileSetting): void {
    const previousIds = this.extractRelatedIds(this.currentTile());
    const nextIds = this.extractRelatedIds(updated);
    const relationsChanged = !this.equalIds(previousIds, nextIds);
    this.currentTile.set(updated);

    if (this.place) {
      const tileSettings = this.upsertTile(this.place.tileSettings, updated);
      const updatedPlace: Place = { ...this.place, tileSettings };
      this.place = updatedPlace;
      void this.placeService.saveAdditionalPlaceInfos(updatedPlace);
      if (this.mode === 'placeContacts' && relationsChanged) {
        void this.syncContactPlaceRelations(updatedPlace.id, previousIds, nextIds);
      }
    } else if (this.contact) {
      const tileSettings = this.upsertTile(this.contact.tileSettings, updated);
      const updatedContact: Contact = { ...this.contact, tileSettings };
      this.contact = updatedContact;
      void this.contactService.saveContactTileSettings(updatedContact, tileSettings);
      this.contactService.refreshContact(updatedContact.id);
      if (this.mode === 'contactPlaces' && relationsChanged) {
        void this.syncPlaceContactRelations(updatedContact.id, previousIds, nextIds);
      }
    }

    this.cdr.markForCheck();
  }

  private upsertTile(tileSettings: TileSetting[] | undefined, updated: TileSetting): TileSetting[] {
    const list = (tileSettings ?? []).map((tile) => ({ ...tile }));
    const index = list.findIndex((tile) => tile.id === updated.id);
    if (index >= 0) {
      list[index] = { ...updated };
      return list;
    }
    return [...list, { ...updated }];
  }

  private extractRelatedIds(tile: TileSetting | null): string[] {
    if (!tile) {
      return [];
    }
    if (tile.type === 'placeContacts') {
      return this.normalizeIds(tile.payload?.relatedContactIds);
    }
    if (tile.type === 'contactPlaces') {
      return this.normalizeIds(tile.payload?.relatedPlaceIds);
    }
    return [];
  }

  private normalizeIds(ids: string[] | undefined): string[] {
    return Array.from(new Set((ids ?? []).filter((id) => !!id)));
  }

  private async syncContactPlaceRelations(placeId: string, previousContactIds: string[], nextContactIds: string[]): Promise<void> {
    const affectedContactIds = Array.from(new Set([...previousContactIds, ...nextContactIds]));
    const nextSet = new Set(nextContactIds);

    for (const contactId of affectedContactIds) {
      const existingContact = this.contactService.contactsSignal().find((entry) => entry.id === contactId);
      if (!existingContact) {
        continue;
      }

      const shouldInclude = nextSet.has(contactId);
      const updatedContact = this.updateContactRelationTile(existingContact, placeId, shouldInclude);
      if (!updatedContact) {
        continue;
      }

      await this.contactService.saveContactTileSettings(updatedContact, updatedContact.tileSettings);
      this.contactService.refreshContact(updatedContact.id);
    }
  }

  private async syncPlaceContactRelations(contactId: string, previousPlaceIds: string[], nextPlaceIds: string[]): Promise<void> {
    const affectedPlaceIds = Array.from(new Set([...previousPlaceIds, ...nextPlaceIds]));
    const nextSet = new Set(nextPlaceIds);

    for (const placeId of affectedPlaceIds) {
      const existingPlace = this.placeService.getPlaces().find((entry) => entry.id === placeId);
      if (!existingPlace) {
        continue;
      }

      const shouldInclude = nextSet.has(placeId);
      const updatedPlace = this.updatePlaceRelationTile(existingPlace, contactId, shouldInclude);
      if (!updatedPlace) {
        continue;
      }

      await this.placeService.saveAdditionalPlaceInfos(updatedPlace);
    }
  }

  private updateContactRelationTile(contact: Contact, placeId: string, shouldInclude: boolean): Contact | null {
    const normalized = normalizeTileSettings(contact.tileSettings, {
      includeDefaults: true,
      includeSystem: false,
      defaultContext: 'contact'
    });

    let changed = false;
    const updatedTiles = normalized.map((tile) => {
      if (tile.type !== 'contactPlaces') {
        return tile;
      }

      const currentIds = this.normalizeIds(tile.payload?.relatedPlaceIds);
      const nextIds = this.updateIdSet(currentIds, placeId, shouldInclude);
      if (this.equalIds(currentIds, nextIds)) {
        return tile;
      }
      changed = true;
      return {
        ...tile,
        payload: {
          ...tile.payload,
          relatedPlaceIds: nextIds
        }
      };
    });

    if (!changed) {
      return null;
    }

    return {
      ...contact,
      tileSettings: updatedTiles
    };
  }

  private updatePlaceRelationTile(place: Place, contactId: string, shouldInclude: boolean): Place | null {
    const normalized = normalizeTileSettings(place.tileSettings, {
      includeDefaults: true,
      includeSystem: true,
      defaultContext: 'place'
    });

    let changed = false;
    const updatedTiles = normalized.map((tile) => {
      if (tile.type !== 'placeContacts') {
        return tile;
      }

      const currentIds = this.normalizeIds(tile.payload?.relatedContactIds);
      const nextIds = this.updateIdSet(currentIds, contactId, shouldInclude);
      if (this.equalIds(currentIds, nextIds)) {
        return tile;
      }
      changed = true;
      return {
        ...tile,
        payload: {
          ...tile.payload,
          relatedContactIds: nextIds
        }
      };
    });

    if (!changed) {
      return null;
    }

    return {
      ...place,
      tileSettings: updatedTiles
    };
  }

  private updateIdSet(ids: string[], value: string, include: boolean): string[] {
    const next = new Set(ids);
    if (include) {
      next.add(value);
    } else {
      next.delete(value);
    }
    return Array.from(next);
  }

  private equalIds(left: string[], right: string[]): boolean {
    if (left.length !== right.length) {
      return false;
    }
    for (let index = 0; index < left.length; index += 1) {
      if (left[index] !== right[index]) {
        return false;
      }
    }
    return true;
  }
}
