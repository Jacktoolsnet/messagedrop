import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { BoundingBox } from '../interfaces/bounding-box';
import { LocalDocument } from '../interfaces/local-document';
import { LocalImage } from '../interfaces/local-image';
import { Message } from '../interfaces/message';
import { Note } from '../interfaces/note';
import { GEODATA_SUBCATEGORIES, GeodataCategory, GeodataPoi, GeodataSubcategory } from '../interfaces/geodata';
import { SearchSettings } from '../interfaces/search-settings';
import { SecretDrop } from '../interfaces/secret-drop';
import { ExperienceResult, ViatorDestinationLookup } from '../interfaces/viator';
import { ExperienceBookmarkService } from './experience-bookmark.service';
import { ExperienceMapService } from './experience-map.service';
import { ExternalContentConsentService } from './external-content-consent.service';
import { IndexedDbService } from './indexed-db.service';
import { MessageService } from './message.service';
import { GeodataService } from './geodata.service';
import { SecretDropService } from './secret-drop.service';
import { UserService } from './user.service';

export interface TripGoRouteContent {
  messages: Message[];
  notes: Note[];
  images: LocalImage[];
  documents: LocalDocument[];
  experiences: ViatorDestinationLookup[];
  myExperiences: Array<{ result: ExperienceResult; location: { latitude: number; longitude: number; plusCode: string } }>;
  secretDrops: SecretDrop[];
  geodataPois: GeodataPoi[];
}

/** Loads map content for a route without changing the content shown on the main map. */
@Injectable({ providedIn: 'root' })
export class TripGoRouteContentService {
  private readonly messages = inject(MessageService);
  private readonly geodata = inject(GeodataService);
  private readonly secretDrops = inject(SecretDropService);
  private readonly indexedDb = inject(IndexedDbService);
  private readonly experiences = inject(ExperienceMapService);
  private readonly experienceBookmarks = inject(ExperienceBookmarkService);
  private readonly externalContentConsent = inject(ExternalContentConsentService);
  private readonly user = inject(UserService);

  async loadBounds(bounds: BoundingBox, settings: SearchSettings, zoom: number): Promise<TripGoRouteContent> {
    const authenticated = this.user.isReady();
    const enabled = (key: keyof SearchSettings) => settings[key].enabled && zoom >= settings[key].minZoom;

    const [messages, secretDrops, notes, images, documents, experiences, myExperiences, geodataPois] = await Promise.all([
      enabled('publicMessages')
        ? firstValueFrom(this.messages.getByBoundingBox(bounds)).then((response) =>
          this.messages.mapRawMessages(response.rows ?? [])).catch(() => [] as Message[])
        : Promise.resolve([] as Message[]),
      enabled('secretDrops')
        ? this.secretDrops.getVisibleOnMapByBoundingBox(bounds, zoom).catch(() => [] as SecretDrop[])
        : Promise.resolve([] as SecretDrop[]),
      authenticated && enabled('privateNotes')
        ? this.indexedDb.getNotesInBoundingBox(bounds).catch(() => [] as Note[])
        : Promise.resolve([] as Note[]),
      authenticated && enabled('privateImages')
        ? this.indexedDb.getImagesInBoundingBox(bounds).catch(() => [] as LocalImage[])
        : Promise.resolve([] as LocalImage[]),
      authenticated && enabled('privateDocuments')
        ? this.indexedDb.getDocumentsInBoundingBox(bounds).catch(() => [] as LocalDocument[])
        : Promise.resolve([] as LocalDocument[]),
      enabled('experiences') && this.externalContentConsent.isEnabled('viator')
        ? this.experiences.getDestinationsInView(bounds, zoom, settings, false)
          .catch(() => [] as ViatorDestinationLookup[])
        : Promise.resolve([] as ViatorDestinationLookup[]),
      authenticated && enabled('myExperiences') && this.externalContentConsent.isEnabled('viator')
        ? this.loadMyExperiences(bounds)
        : Promise.resolve([] as Array<{ result: ExperienceResult; location: { latitude: number; longitude: number; plusCode: string } }>),
      this.loadGeodataPois(bounds, settings, zoom)
    ]);

    return { messages, secretDrops, notes, images, documents, experiences, myExperiences, geodataPois };
  }

  private async loadGeodataPois(bounds: BoundingBox, settings: SearchSettings, zoom: number): Promise<GeodataPoi[]> {
    const categories: Partial<Record<GeodataCategory, GeodataSubcategory[]>> = {};
    (Object.keys(GEODATA_SUBCATEGORIES) as GeodataCategory[]).forEach((category) => {
      const setting = settings[category];
      if (!setting.enabled || zoom < setting.minZoom) return;
      const selected = GEODATA_SUBCATEGORIES[category]
        .filter((subcategory) => setting.subcategories[subcategory]) as GeodataSubcategory[];
      if (selected.length) categories[category] = selected;
    });
    if (!Object.keys(categories).length) return [];
    return firstValueFrom(this.geodata.getNearby([bounds], categories)).catch(() => []);
  }

  private async loadMyExperiences(bounds: BoundingBox) {
    await this.experienceBookmarks.ensureLoaded().catch(() => undefined);
    const found: Array<{ result: ExperienceResult; location: { latitude: number; longitude: number; plusCode: string } }> = [];
    for (const bookmark of this.experienceBookmarks.bookmarksSignal()) {
      const destinationId = bookmark.snapshot.destinationIds?.[0];
      if (!destinationId) continue;
      const destination = await this.experiences.getDestinationById(destinationId);
      const latitude = destination?.center?.latitude;
      const longitude = destination?.center?.longitude;
      if (latitude === undefined || longitude === undefined || latitude < bounds.latMin || latitude > bounds.latMax
        || longitude < bounds.lonMin || longitude > bounds.lonMax) continue;
      found.push({ result: bookmark.snapshot, location: { latitude, longitude, plusCode: destination?.plusCode || '' } });
    }
    return found;
  }
}
