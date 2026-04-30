import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogContent, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { TranslocoPipe } from '@jsverse/transloco';
import { GetNominatimAddressResponse } from '../../../../interfaces/get-nominatim-address-response copy';
import { Contact } from '../../../../interfaces/contact';
import { Location } from '../../../../interfaces/location';
import { NominatimPlace } from '../../../../interfaces/nominatim-place';
import { Place } from '../../../../interfaces/place';
import { TileSetting, createDefaultTileSettings } from '../../../../interfaces/tile-settings';
import { ContactService } from '../../../../services/contact.service';
import { DisplayMessageService } from '../../../../services/display-message.service';
import { GeolocationService } from '../../../../services/geolocation.service';
import { MapService } from '../../../../services/map.service';
import { NominatimService } from '../../../../services/nominatim.service';
import { PlaceService } from '../../../../services/place.service';
import { TranslationHelperService } from '../../../../services/translation-helper.service';
import { UserService } from '../../../../services/user.service';
import { DialogHeaderComponent } from '../../../utils/dialog-header/dialog-header.component';
import { HelpDialogService } from '../../../utils/help-dialog/help-dialog.service';
import { LocationPickerDialogComponent } from '../../../utils/location-picker-dialog/location-picker-dialog.component';
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

interface TimezoneResponse { status: number; timezone: string }

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
  private readonly userService = inject(UserService);
  private readonly mapService = inject(MapService);
  private readonly geolocationService = inject(GeolocationService);
  private readonly nominatimService = inject(NominatimService);
  private readonly snackBar = inject(DisplayMessageService);
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
  readonly items = signal<RelationDialogItem[]>(this.buildItems());
  readonly creatingPlace = signal(false);

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
    const items = this.items();
    const filter = this.filterValue().trim().toLocaleLowerCase();
    if (!filter) {
      return items;
    }
    return items.filter((item) => item.name.toLocaleLowerCase().includes(filter));
  }

  get canCreateFirstPlace(): boolean {
    return this.mode === 'contactPlaces' && this.items().length === 0 && this.userService.hasJwt();
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

  addPlace(): void {
    if (!this.userService.hasJwt() || this.creatingPlace()) {
      return;
    }

    const dialogRef = this.dialog.open(LocationPickerDialogComponent, {
      data: { location: this.mapService.getMapLocation(), markerType: 'message' },
      maxWidth: '95vw',
      maxHeight: '95vh',
      width: '95vw',
      height: '95vh',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: false
    });

    dialogRef.afterClosed().subscribe((location?: Location) => {
      if (!location) {
        return;
      }
      void this.createPlaceFromLocation(location);
    });
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
    return this.items()
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

  private async createPlaceFromLocation(location: Location): Promise<void> {
    this.creatingPlace.set(true);
    const place = this.buildNewPlace(location);

    try {
      const nominatimAddressResponse = await firstValueFrom(
        this.nominatimService.getNominatimPlaceByLocation(place.location, true)
      ) as GetNominatimAddressResponse;

      if (nominatimAddressResponse.status === 200) {
        const nominatimPlace: NominatimPlace | undefined = nominatimAddressResponse.nominatimPlace;
        if (nominatimPlace && !nominatimPlace.error) {
          place.name = nominatimPlace.name ? nominatimPlace.name : this.nominatimService.getFormattedStreet(nominatimPlace, ' ');
          place.icon = this.nominatimService.getIconForPlace(nominatimPlace);
          place.boundingBox = this.nominatimService.getBoundingBoxFromNominatimPlace(nominatimPlace);
          place.location = this.nominatimService.getLocationFromNominatimPlace(nominatimPlace);
        }
      }

      await this.persistPlace(place);
      this.addCreatedPlaceToSelection(place);
    } catch (err) {
      this.snackBar.open(
        err instanceof Error ? err.message : this.translation.t('common.placeList.createFailed'),
        this.translation.t('common.actions.ok'),
        { duration: 3000 }
      );
    } finally {
      this.creatingPlace.set(false);
    }
  }

  private buildNewPlace(location: Location): Place {
    const resolvedLocation = location.plusCode
      ? { ...location }
      : { ...location, plusCode: this.geolocationService.getPlusCode(location.latitude, location.longitude) };
    return {
      id: '',
      userId: this.userService.getUser().id,
      name: '',
      hashtags: [],
      location: resolvedLocation,
      base64Avatar: '',
      placeBackgroundImage: '',
      placeBackgroundTransparency: 40,
      icon: '',
      subscribed: false,
      pinned: false,
      sortOrder: this.placeService.getNextSortOrder(),
      boundingBox: this.geolocationService.getBoundingBoxFromPlusCodes([resolvedLocation.plusCode]),
      timezone: '',
      tileSettings: createDefaultTileSettings(),
      datasets: {
        weatherDataset: {
          data: undefined,
          lastUpdate: undefined
        },
        airQualityDataset: {
          data: undefined,
          lastUpdate: undefined
        }
      }
    };
  }

  private async persistPlace(place: Place): Promise<void> {
    const timezoneResponse = await firstValueFrom(
      this.placeService.getTimezone(this.geolocationService.getCenterOfBoundingBox(place.boundingBox))
    ) as TimezoneResponse;

    if (timezoneResponse.status === 200 && timezoneResponse.timezone) {
      place.timezone = timezoneResponse.timezone;
    }

    const createPlaceResponse = await firstValueFrom(this.placeService.createPlace(place));
    if (createPlaceResponse.status !== 200) {
      throw new Error(this.translation.t('common.placeList.createFailed'));
    }

    place.id = createPlaceResponse.placeId;
    await this.placeService.saveAdditionalPlaceInfos(place);
    this.snackBar.open(this.translation.t('common.placeList.createSuccess'), '', { duration: 1000 });
  }

  private addCreatedPlaceToSelection(place: Place): void {
    const item = this.placeToDialogItem(place);
    this.items.update((items) => [...items, item]);
    this.selectedIds.update((ids) => new Set([...ids, place.id]));
    this.filterValue.set('');
  }

  private placeToDialogItem(place: Place): RelationDialogItem {
    const name = place.name?.trim() || this.translation.t('common.placeList.nameFallback');
    return {
      id: place.id,
      name,
      avatarUrl: place.base64Avatar,
      avatarAlt: place.name
        ? this.translation.t('common.placeList.avatarAltName', { name: place.name })
        : this.translation.t('common.placeList.avatarAltFallback'),
      fallbackIcon: place.icon || 'place'
    };
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
    const updated = this.buildUpdatedTile(this.getOrderedSelectedIds());
    this.data.tile = updated;
    this.data.onTileCommit?.(updated);
  }

  private normalizeIds(ids: string[] | undefined): string[] {
    return Array.from(new Set((ids ?? []).filter((id) => !!id)));
  }
}
