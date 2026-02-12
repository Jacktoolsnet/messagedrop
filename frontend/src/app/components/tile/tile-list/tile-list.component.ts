import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { TranslocoPipe } from '@jsverse/transloco';
import { MasonryItemDirective } from "../../../directives/masonry-item.directive";
import { AvatarAttribution } from '../../../interfaces/avatar-attribution';
import { Contact } from '../../../interfaces/contact';
import { ExperienceTileContext } from '../../../interfaces/experience-tile-context';
import { Place } from '../../../interfaces/place';
import { TileSetting, normalizeTileSettings } from '../../../interfaces/tile-settings';
import { ContactService } from '../../../services/contact.service';
import { ExperienceBookmarkService } from '../../../services/experience-bookmark.service';
import { PlaceService } from '../../../services/place.service';
import { AirQualityTileComponent } from "../air-quality-tile/air-quality-tile.component";
import { AnniversaryTileComponent } from "../anniversary-tile/anniversary-tile.component";
import { DateTimeTileComponent } from "../datetime-tile/datetime-tile.component";
import { FileTileComponent } from "../file-tile/file-tile.component";
import { ExperienceTileComponent } from "../experience-tile/experience-tile.component";
import { HashtagTileComponent } from "../hashtag-tile/hashtag-tile.component";
import { ImageTileComponent } from "../image-tile/image-tile.component";
import { MessageTileComponent } from "../message-tile/messagetile.component";
import { MigraineTileComponent } from "../migraine-tile/migraine-tile.component";
import { MultitextTileComponent } from "../multitext-tile/multitext-tile.component";
import { NoteTileComponent } from "../note-tile/note-tile.component";
import { PollutionTileComponent } from "../pollution-tile/pollution-tile.component";
import { QuickActionTileComponent } from "../quick-action-tile/quick-action-tile.component";
import { TextTileComponent } from "../text-tile/text-tile.component";
import { TileSettingsComponent } from '../tile-settings/tile-settings.component';
import { TodoTileComponent } from "../todo-tile/todo-tile.component";
import { WeatherTileComponent } from "../weather-tile/weather-tile.component";

@Component({
  selector: 'app-tile-list',
  imports: [DateTimeTileComponent, WeatherTileComponent, AirQualityTileComponent, NoteTileComponent, MessageTileComponent, HashtagTileComponent, ImageTileComponent, FileTileComponent, ExperienceTileComponent, TextTileComponent, MultitextTileComponent, AnniversaryTileComponent, MigraineTileComponent, PollutionTileComponent, TodoTileComponent, QuickActionTileComponent, MasonryItemDirective, MatButtonModule, TranslocoPipe],
  templateUrl: './tile-list.component.html',
  styleUrl: './tile-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TileListComponent {
  @Input() place?: Place;
  @Input() contact?: Contact;
  @Input() experience?: ExperienceTileContext;

  private readonly dialog = inject(MatDialog);
  private readonly placeService = inject(PlaceService);
  private readonly contactService = inject(ContactService);
  private readonly experienceBookmarkService = inject(ExperienceBookmarkService);
  private readonly cdr = inject(ChangeDetectorRef);

  private readonly renderableTypes = new Set<TileSetting['type']>([
    'datetime',
    'weather',
    'airQuality',
    'note',
    'message',
    'hashtags',
    'image',
    'custom-experience',
    'custom-text',
    'custom-multitext',
    'custom-date',
    'custom-todo',
    'custom-quickaction',
    'custom-file',
    'custom-migraine',
    'custom-pollution'
  ]);
  private readonly experienceRenderableTypes = new Set<TileSetting['type']>([
    'hashtags',
    'custom-text',
    'custom-multitext',
    'custom-todo',
    'custom-quickaction',
    'custom-file'
  ]);

  get resolvedPlace(): Place | undefined {
    if (!this.place) return undefined;
    return this.placeService.getPlaces().find(p => p.id === this.place?.id) ?? this.place;
  }

  get resolvedContact(): Contact | undefined {
    if (!this.contact) return undefined;
    return this.contactService.contactsSignal().find(c => c.id === this.contact?.id) ?? this.contact;
  }

  get resolvedExperience(): ExperienceTileContext | undefined {
    return this.experience;
  }

  get visibleTiles(): TileSetting[] {
    if (!this.place && !this.contact && !this.experience) return [];
    const contact = this.resolvedContact;
    const place = this.resolvedPlace;
    const experience = this.resolvedExperience;
    const sourceTiles = contact
      ? contact.tileSettings
      : place
        ? place.tileSettings
        : experience?.tileSettings;
    const opts = contact
      ? { includeDefaults: true, includeSystem: false, defaultContext: 'contact' as const }
      : experience
        ? { includeDefaults: true, includeSystem: false, defaultContext: 'experience' as const }
        : { includeDefaults: true, includeSystem: true, defaultContext: 'place' as const };
    const allowed = experience ? this.experienceRenderableTypes : this.renderableTypes;
    return normalizeTileSettings(sourceTiles, opts)
      .filter((tile: TileSetting) => tile.enabled && allowed.has(tile.type));
  }

  get hasVisibleTiles(): boolean {
    return this.visibleTiles.length > 0;
  }

  get avatarAttribution(): AvatarAttribution | undefined {
    return this.resolvedContact?.avatarAttribution ?? this.resolvedPlace?.avatarAttribution;
  }

  get backgroundAttribution(): AvatarAttribution | undefined {
    return this.resolvedContact?.chatBackgroundAttribution ?? this.resolvedPlace?.placeBackgroundAttribution;
  }

  get hasDualUnsplashAttribution(): boolean {
    return this.avatarAttribution?.source === 'unsplash' && this.backgroundAttribution?.source === 'unsplash';
  }

  get singleUnsplashAttribution(): AvatarAttribution | undefined {
    const background = this.backgroundAttribution;
    if (background?.source === 'unsplash') {
      return background;
    }
    const avatar = this.avatarAttribution;
    if (avatar?.source === 'unsplash') {
      return avatar;
    }
    return undefined;
  }

  getTileBackgroundImage(): string {
    const contact = this.resolvedContact;
    const place = this.resolvedPlace;
    const experience = this.resolvedExperience;
    if (contact?.chatBackgroundImage) {
      return `url(${contact.chatBackgroundImage})`;
    }
    if (experience?.imageUrl) {
      return `url(${experience.imageUrl})`;
    }
    return place?.placeBackgroundImage ? `url(${place.placeBackgroundImage})` : 'none';
  }

  getTileBackgroundOpacity(): number {
    const contact = this.resolvedContact;
    const place = this.resolvedPlace;
    const experience = this.resolvedExperience;
    if (contact?.chatBackgroundImage) {
      const transparency = contact.chatBackgroundTransparency ?? 40;
      const clamped = Math.min(Math.max(transparency, 0), 100);
      return 1 - clamped / 100;
    }
    if (!place?.placeBackgroundImage) {
      return experience?.imageUrl ? 0.9 : 0;
    }
    const transparency = place.placeBackgroundTransparency ?? 40;
    const clamped = Math.min(Math.max(transparency, 0), 100);
    return 1 - clamped / 100;
  }

  openTileSettings(): void {
    const contact = this.resolvedContact;
    const place = this.resolvedPlace;
    const experience = this.resolvedExperience;
    const dialogRef = this.dialog.open(TileSettingsComponent, {
      width: 'auto',
      minWidth: 'min(450px, 95vw)',
      maxWidth: '90vw',
      maxHeight: '90vh',
      data: contact ? { contact } : place ? { place } : { experience },
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
    });

    dialogRef.afterClosed().subscribe((updatedSettings?: TileSetting[]) => {
      if (!updatedSettings) {
        return;
      }

      const normalizeOptions = contact
        ? { includeDefaults: true, includeSystem: false, defaultContext: 'contact' as const }
        : place
          ? { includeDefaults: true, includeSystem: true, defaultContext: 'place' as const }
          : { includeDefaults: true, includeSystem: false, defaultContext: 'experience' as const };
      const normalized = normalizeTileSettings(updatedSettings, normalizeOptions)
        .map((tile: TileSetting) => ({ ...tile }));

      if (contact) {
        const updatedContact = { ...contact, tileSettings: normalized };
        this.contact = updatedContact;
        void this.contactService.saveContactTileSettings(updatedContact, normalized);
      } else if (place) {
        const updatedPlace = { ...place, tileSettings: normalized };
        this.place = updatedPlace;
        this.placeService.saveAdditionalPlaceInfos(updatedPlace);
      } else if (experience?.productCode) {
        const updatedExperience = { ...experience, tileSettings: normalized };
        this.experience = updatedExperience;
        void this.experienceBookmarkService.saveTileSettings(experience.productCode, normalized);
      }
      this.cdr.detectChanges();
    });
  }

  trackByTile = (_: number, tile: TileSetting) => tile.id;
}
