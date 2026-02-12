import { DestroyRef, Component, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { BoundingBox } from '../../../interfaces/bounding-box';
import { HelpDialogService, HelpTopic } from '../help-dialog/help-dialog.service';
import { Contact } from '../../../interfaces/contact';
import { Location } from '../../../interfaces/location';
import { Message } from '../../../interfaces/message';
import { Note } from '../../../interfaces/note';
import { Place } from '../../../interfaces/place';
import { ExperienceBookmark } from '../../../interfaces/experience-bookmark';
import { ViatorDestinationLookup } from '../../../interfaces/viator';
import { ContactService } from '../../../services/contact.service';
import { ExperienceBookmarkService } from '../../../services/experience-bookmark.service';
import { GeolocationService } from '../../../services/geolocation.service';
import { MapService } from '../../../services/map.service';
import { MessageService } from '../../../services/message.service';
import { NoteService } from '../../../services/note.service';
import { PlaceService } from '../../../services/place.service';
import { TranslationHelperService } from '../../../services/translation-helper.service';
import { UserService } from '../../../services/user.service';
import { ViatorService } from '../../../services/viator.service';
import { normalizeHashtags, stringifyHashtags } from '../../../utils/hashtag.util';
import { HashtagMapItem, HashtagResultsMapComponent } from './components/hashtag-results-map/hashtag-results-map.component';

export interface HashtagSearchDialogData {
  initialTag?: string;
  helpKey?: HelpTopic;
}

export interface HashtagSearchResult {
  type: 'message' | 'place' | 'contact' | 'experience' | 'note';
  message?: Message;
  place?: Place;
  contact?: Contact;
  experience?: ExperienceBookmark;
  note?: Note;
}

interface HashtagSearchListTile {
  id: string;
  icon: string;
  categoryKey: string;
  title: string;
  description?: string;
  tagsLabel?: string;
  result: HashtagSearchResult;
}

@Component({
  selector: 'app-hashtag-search',
  standalone: true,
  imports: [
    FormsModule,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    MatButtonModule,
    MatIconModule,
    HashtagResultsMapComponent,
    TranslocoPipe
  ],
  templateUrl: './hashtag-search.component.html',
  styleUrl: './hashtag-search.component.css'
})
export class HashtagSearchComponent {
  readonly data = inject<HashtagSearchDialogData | null>(MAT_DIALOG_DATA, { optional: true });
  private readonly dialogRef = inject(MatDialogRef<HashtagSearchComponent, HashtagSearchResult>);
  private readonly destroyRef = inject(DestroyRef);
  private readonly messageService = inject(MessageService);
  private readonly placeService = inject(PlaceService);
  private readonly contactService = inject(ContactService);
  private readonly noteService = inject(NoteService);
  private readonly bookmarkService = inject(ExperienceBookmarkService);
  private readonly geolocationService = inject(GeolocationService);
  private readonly mapService = inject(MapService);
  private readonly viatorService = inject(ViatorService);
  private readonly i18n = inject(TranslationHelperService);
  readonly userService = inject(UserService);
  readonly help = inject(HelpDialogService);
  readonly helpTopic: HelpTopic = this.data?.helpKey ?? 'hashtagSearch';

  query = (this.data?.initialTag ?? '').trim();
  errorText = signal('');
  loadingPublic = signal(false);
  normalizedTag = signal('');
  hasSearched = signal(false);
  selectedMapItemId = signal<string | null>(null);
  readonly localMode = computed(() => this.userService.isReady());
  viewMode: 'list' | 'map' = 'map';
  mapView = {
    center: { latitude: 0, longitude: 0, plusCode: '' },
    zoom: 3
  };

  readonly publicResults = signal<Message[]>([]);
  readonly localPlaceResults = signal<Place[]>([]);
  readonly localContactResults = signal<Contact[]>([]);
  readonly localNoteResults = signal<Note[]>([]);
  readonly localExperienceResults = signal<ExperienceBookmark[]>([]);
  private readonly noteResultsSignal = this.noteService.getNotesSignal();
  private readonly destinationCache = new Map<number, ViatorDestinationLookup>();
  private readonly experienceLocations = signal<Map<string, Location>>(new Map());
  private experienceLookupRevision = 0;

  readonly publicMessages = computed(() =>
    this.publicResults().filter((message) => message.typ === 'public')
  );
  readonly publicComments = computed(() =>
    this.publicResults().filter((message) => message.typ === 'comment')
  );

  readonly hasAnyResult = computed(() =>
    this.publicResults().length > 0
    || this.localPlaceResults().length > 0
    || this.localContactResults().length > 0
    || this.localNoteResults().length > 0
    || this.localExperienceResults().length > 0
  );
  readonly listTiles = computed<HashtagSearchListTile[]>(() => {
    const tiles: HashtagSearchListTile[] = [];

    this.localPlaceResults().forEach((place) => {
      tiles.push({
        id: `tile-place:${place.id}`,
        icon: 'place',
        categoryKey: 'common.hashtagSearch.sections.places',
        title: place.name || this.i18n.t('common.placeList.nameFallback'),
        tagsLabel: place.hashtags?.length ? this.hashtagsLabel(place.hashtags) : undefined,
        result: { type: 'place', place }
      });
    });

    this.localContactResults().forEach((contact) => {
      tiles.push({
        id: `tile-contact:${contact.id}`,
        icon: 'contacts',
        categoryKey: 'common.hashtagSearch.sections.contacts',
        title: contact.name || this.i18n.t('common.contact.list.nameFallback'),
        tagsLabel: contact.hashtags?.length ? this.hashtagsLabel(contact.hashtags) : undefined,
        result: { type: 'contact', contact }
      });
    });

    this.localExperienceResults().forEach((experience) => {
      tiles.push({
        id: `tile-experience:${this.getExperienceMapKey(experience)}`,
        icon: 'bookmark_star',
        categoryKey: 'common.hashtagSearch.sections.experiences',
        title: experience.snapshot.title || experience.productCode,
        description: this.getExperiencePreview(experience),
        tagsLabel: experience.hashtags?.length ? this.hashtagsLabel(experience.hashtags) : undefined,
        result: { type: 'experience', experience }
      });
    });

    this.localNoteResults().forEach((note) => {
      tiles.push({
        id: `tile-note:${note.id}`,
        icon: 'clinical_notes',
        categoryKey: 'common.hashtagSearch.sections.notes',
        title: this.getNotePreview(note),
        tagsLabel: note.hashtags?.length ? this.hashtagsLabel(note.hashtags) : undefined,
        result: { type: 'note', note }
      });
    });

    this.publicMessages().forEach((message) => {
      tiles.push({
        id: `tile-public-message:${message.uuid}`,
        icon: 'forum',
        categoryKey: 'common.hashtagSearch.sections.publicMessages',
        title: this.getPublicPreview(message),
        tagsLabel: message.hashtags?.length ? this.hashtagsLabel(message.hashtags) : undefined,
        result: { type: 'message', message }
      });
    });

    this.publicComments().forEach((message) => {
      tiles.push({
        id: `tile-comment:${message.uuid}`,
        icon: 'chat',
        categoryKey: 'common.hashtagSearch.sections.comments',
        title: this.getPublicPreview(message),
        tagsLabel: message.hashtags?.length ? this.hashtagsLabel(message.hashtags) : undefined,
        result: { type: 'message', message }
      });
    });

    return tiles;
  });
  readonly mapItems = computed<HashtagMapItem[]>(() => {
    const items: HashtagMapItem[] = [];
    const experienceLocations = this.experienceLocations();
    this.localPlaceResults().forEach((place) => {
      const location = this.normalizeLocation(place.location);
      if (!location) {
        return;
      }
      items.push({
        id: `place:${place.id}`,
        type: 'place',
        label: place.name || this.i18n.t('common.placeList.nameFallback'),
        location
      });
    });

    this.localExperienceResults().forEach((experience) => {
      const key = this.getExperienceMapKey(experience);
      const location = experienceLocations.get(key);
      if (!location) {
        return;
      }
      items.push({
        id: `experience:${key}`,
        type: 'experience',
        label: experience.snapshot.title || experience.productCode,
        location
      });
    });

    this.localNoteResults().forEach((note) => {
      const location = this.normalizeLocation(note.location);
      if (!location) {
        return;
      }
      items.push({
        id: `note:${note.id}`,
        type: 'note',
        label: this.getNotePreview(note),
        location
      });
    });

    this.publicResults().forEach((message) => {
      const location = this.normalizeLocation(message.location);
      if (!location) {
        return;
      }
      items.push({
        id: `message:${message.uuid}`,
        type: 'message',
        label: this.getPublicPreview(message),
        location
      });
    });
    return items;
  });

  constructor() {
    void this.bookmarkService.ensureLoaded();
    if (this.userService.isReady()) {
      this.contactService.initContacts(this.userService.hasJwt());
      void this.noteService.loadNotes();
    }
    const bounds = this.mapService.getVisibleMapBoundingBox();
    this.mapView = {
      center: this.geolocationService.getCenterOfBoundingBox(bounds),
      zoom: this.mapService.getMapZoom()
    };
    effect(() => {
      const tag = this.normalizedTag();
      const searched = this.hasSearched();
      const localAvailable = this.localMode();
      this.placeService.sortedPlacesSignal();
      this.contactService.sortedContactsSignal();
      this.noteResultsSignal();
      this.bookmarkService.bookmarksSignal();
      if (!searched || !localAvailable || !tag) {
        return;
      }
      this.searchLocal(tag);
    });
    if (this.query) {
      this.search();
    }
  }

  search(): void {
    this.selectedMapItemId.set(null);
    this.viewMode = 'map';
    const parsed = normalizeHashtags([this.query], 1);
    if (parsed.invalidTokens.length > 0 || parsed.tags.length === 0 || parsed.overflow > 0) {
      this.errorText.set(this.i18n.t('common.hashtags.invalidSearch'));
      this.hasSearched.set(true);
      this.clearResults();
      return;
    }
    this.errorText.set('');
    this.clearResults();
    const tag = parsed.tags[0];
    this.normalizedTag.set(tag);
    this.hasSearched.set(true);
    if (this.localMode()) {
      void this.noteService.loadNotes();
      this.searchLocal(tag);
    }
    this.searchPublic(tag);
  }

  selectMessage(message: Message): void {
    this.dialogRef.close({ type: 'message', message });
  }

  selectPlace(place: Place): void {
    this.dialogRef.close({ type: 'place', place });
  }

  selectContact(contact: Contact): void {
    this.dialogRef.close({ type: 'contact', contact });
  }

  selectExperience(experience: ExperienceBookmark): void {
    this.dialogRef.close({ type: 'experience', experience });
  }

  selectNote(note: Note): void {
    this.dialogRef.close({ type: 'note', note });
  }

  toggleViewMode(): void {
    this.viewMode = this.viewMode === 'list' ? 'map' : 'list';
  }

  onViewChange(event: { center: Location; zoom: number; bounds: BoundingBox }): void {
    this.mapView = {
      center: event.center,
      zoom: event.zoom
    };
  }

  onMapItemSelected(itemId: string): void {
    this.selectedMapItemId.set(itemId);
    if (itemId.startsWith('place:')) {
      const placeId = itemId.slice('place:'.length);
      const place = this.localPlaceResults().find((entry) => entry.id === placeId);
      if (place) {
        this.selectPlace(place);
      }
      return;
    }

    if (itemId.startsWith('experience:')) {
      const key = itemId.slice('experience:'.length);
      const experience = this.localExperienceResults().find((entry) => this.getExperienceMapKey(entry) === key);
      if (experience) {
        this.selectExperience(experience);
      }
      return;
    }

    if (itemId.startsWith('note:')) {
      const noteId = itemId.slice('note:'.length);
      const note = this.localNoteResults().find((entry) => entry.id === noteId);
      if (note) {
        this.selectNote(note);
      }
      return;
    }

    if (itemId.startsWith('message:')) {
      const uuid = itemId.slice('message:'.length);
      const message = this.publicResults().find((entry) => entry.uuid === uuid);
      if (message) {
        this.selectMessage(message);
      }
    }
  }

  onListTileSelected(tile: HashtagSearchListTile): void {
    const result = tile.result;
    if (result.type === 'place' && result.place) {
      this.selectPlace(result.place);
      return;
    }
    if (result.type === 'contact' && result.contact) {
      this.selectContact(result.contact);
      return;
    }
    if (result.type === 'experience' && result.experience) {
      this.selectExperience(result.experience);
      return;
    }
    if (result.type === 'note' && result.note) {
      this.selectNote(result.note);
      return;
    }
    if (result.type === 'message' && result.message) {
      this.selectMessage(result.message);
    }
  }

  hashtagsLabel(tags: string[] | undefined): string {
    return stringifyHashtags(tags ?? []);
  }

  getPublicPreview(message: Message): string {
    const text = message.message || '';
    if (text.length <= 140) {
      return text;
    }
    return `${text.slice(0, 140)}…`;
  }

  getExperiencePreview(experience: ExperienceBookmark): string | undefined {
    const text = (experience.snapshot.description || '').trim();
    if (!text) {
      return undefined;
    }
    if (text.length <= 140) {
      return text;
    }
    return `${text.slice(0, 140)}…`;
  }

  getNotePreview(note: Note): string {
    const text = (note.note || '').trim();
    if (!text) {
      return this.i18n.t('common.menu.myPrivateNotes');
    }
    if (text.length <= 140) {
      return text;
    }
    return `${text.slice(0, 140)}…`;
  }

  private clearResults(): void {
    this.experienceLookupRevision += 1;
    this.publicResults.set([]);
    this.localPlaceResults.set([]);
    this.localContactResults.set([]);
    this.localNoteResults.set([]);
    this.localExperienceResults.set([]);
    this.experienceLocations.set(new Map());
  }

  private searchLocal(tag: string): void {
    const places = this.placeService.sortedPlacesSignal().filter((place) => this.hasTag(place.hashtags, tag));
    const contacts = this.contactService.sortedContactsSignal().filter((contact) => this.hasTag(contact.hashtags, tag));
    const notes = this.noteResultsSignal().filter((note) => this.hasTag(note.hashtags, tag));
    const experiences = this.bookmarkService.bookmarksSignal().filter((bookmark) => this.hasTag(bookmark.hashtags, tag));
    this.localPlaceResults.set(places);
    this.localContactResults.set(contacts);
    this.localNoteResults.set(notes);
    this.localExperienceResults.set(experiences);
    this.resolveExperienceLocations(experiences);
  }

  private searchPublic(tag: string): void {
    this.loadingPublic.set(true);
    this.messageService.searchByHashtag(tag, false).subscribe({
      next: (response) => {
        const mapped = this.messageService.mapRawMessages(response.rows ?? []);
        this.publicResults.set(
          mapped.filter((message) => this.hasTag(message.hashtags, tag))
        );
        this.loadingPublic.set(false);
      },
      error: () => {
        this.publicResults.set([]);
        this.loadingPublic.set(false);
        this.errorText.set(this.i18n.t('common.hashtagSearch.publicFailed'));
      }
    });
  }

  private hasTag(tags: string[] | undefined, tag: string): boolean {
    return Array.isArray(tags) && tags.some((item) => item === tag);
  }

  private resolveExperienceLocations(experiences: ExperienceBookmark[]): void {
    const revision = ++this.experienceLookupRevision;
    this.rebuildExperienceLocations(experiences, revision);

    const missingDestinationIds = new Set<number>();
    experiences.forEach((experience) => {
      this.getExperienceDestinationIds(experience).forEach((id) => {
        if (!this.destinationCache.has(id)) {
          missingDestinationIds.add(id);
        }
      });
    });

    const missing = Array.from(missingDestinationIds).slice(0, 200);
    if (!missing.length) {
      return;
    }

    this.viatorService.getDestinations(missing, false)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (revision !== this.experienceLookupRevision) {
            return;
          }
          const destinations = Array.isArray(response.destinations) ? response.destinations : [];
          destinations.forEach((destination) => {
            if (destination && typeof destination.destinationId === 'number' && destination.destinationId > 0) {
              this.destinationCache.set(destination.destinationId, destination);
            }
          });
          this.rebuildExperienceLocations(experiences, revision);
        },
        error: () => {
          if (revision !== this.experienceLookupRevision) {
            return;
          }
          this.rebuildExperienceLocations(experiences, revision);
        }
      });
  }

  private rebuildExperienceLocations(experiences: ExperienceBookmark[], revision: number): void {
    if (revision !== this.experienceLookupRevision) {
      return;
    }
    const next = new Map<string, Location>();
    experiences.forEach((experience) => {
      const location = this.resolveExperienceLocation(experience);
      if (!location) {
        return;
      }
      next.set(this.getExperienceMapKey(experience), location);
    });
    this.experienceLocations.set(next);
  }

  private resolveExperienceLocation(experience: ExperienceBookmark): Location | null {
    const destinationIds = this.getExperienceDestinationIds(experience);
    for (const destinationId of destinationIds) {
      const destination = this.destinationCache.get(destinationId);
      if (!destination) {
        continue;
      }
      const latitude = Number(destination.center?.latitude);
      const longitude = Number(destination.center?.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        continue;
      }
      return {
        latitude,
        longitude,
        plusCode: destination.plusCode || this.geolocationService.getPlusCode(latitude, longitude)
      };
    }
    return null;
  }

  private getExperienceDestinationIds(experience: ExperienceBookmark): number[] {
    const ids = Array.isArray(experience.snapshot.destinationIds)
      ? experience.snapshot.destinationIds
      : [];
    return ids
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id) && id > 0)
      .map((id) => Math.trunc(id));
  }

  private getExperienceMapKey(experience: ExperienceBookmark): string {
    if (experience.productCode) {
      return experience.productCode;
    }
    if (experience.snapshot.productCode) {
      return experience.snapshot.productCode;
    }
    return experience.snapshot.trackId;
  }

  private normalizeLocation(location: Location | undefined): Location | null {
    if (!location) {
      return null;
    }
    const latitude = Number(location.latitude);
    const longitude = Number(location.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return null;
    }
    return {
      latitude,
      longitude,
      plusCode: location.plusCode || this.geolocationService.getPlusCode(latitude, longitude)
    };
  }
}
