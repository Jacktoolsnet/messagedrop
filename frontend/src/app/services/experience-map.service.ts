import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { BoundingBox } from '../interfaces/bounding-box';
import { DEFAULT_SEARCH_SETTINGS, SearchSettings } from '../interfaces/search-settings';
import { ViatorDestinationLookup } from '../interfaces/viator';
import { ViatorService } from './viator.service';

@Injectable({
  providedIn: 'root'
})
export class ExperienceMapService {
  private readonly viatorService = inject(ViatorService);

  private destinations: ViatorDestinationLookup[] = [];
  private destinationsLoaded = false;
  private destinationsLoading = false;
  private destinationsLastFailure?: number;

  async getDestinationsInView(
    bbox: BoundingBox,
    zoom: number,
    settings: SearchSettings,
    ignoreSearchSettings: boolean
  ): Promise<ViatorDestinationLookup[]> {
    const enabled = ignoreSearchSettings ? true : settings.experiences.enabled;
    const minZoom = ignoreSearchSettings
      ? DEFAULT_SEARCH_SETTINGS.experiences.minZoom
      : settings.experiences.minZoom;

    if (!enabled || zoom < minZoom) {
      return [];
    }

    await this.ensureDestinationsLoaded();
    const candidates = this.filterDestinationsInBounds(this.destinations, bbox);
    const types = this.getDestinationTypesForZoom(zoom);
    const filtered = this.filterDestinationsByType(candidates, types);
    return (filtered.length ? filtered : candidates).slice(0, 250);
  }

  private async ensureDestinationsLoaded(): Promise<void> {
    if (this.destinationsLastFailure && Date.now() - this.destinationsLastFailure < 60_000) {
      return;
    }
    if (this.destinationsLoaded || this.destinationsLoading) {
      return;
    }
    this.destinationsLoading = true;
    try {
      const response = await firstValueFrom(this.viatorService.getAllDestinations(false));
      this.destinations = response?.destinations ?? [];
      this.destinationsLoaded = true;
    } catch {
      this.destinations = [];
      this.destinationsLastFailure = Date.now();
    } finally {
      this.destinationsLoading = false;
    }
  }

  private filterDestinationsInBounds(
    destinations: ViatorDestinationLookup[],
    bbox: BoundingBox
  ): ViatorDestinationLookup[] {
    return destinations.filter((dest) => {
      const center = dest.center;
      if (!center || center.latitude === undefined || center.longitude === undefined) {
        return false;
      }
      return (
        center.latitude >= bbox.latMin &&
        center.latitude <= bbox.latMax &&
        center.longitude >= bbox.lonMin &&
        center.longitude <= bbox.lonMax
      );
    });
  }

  private filterDestinationsByType(destinations: ViatorDestinationLookup[], types: string[]): ViatorDestinationLookup[] {
    if (!types.length) return destinations;
    const allowed = new Set(types.map((type) => type.toUpperCase()));
    return destinations.filter((dest) => dest.type && allowed.has(dest.type.toUpperCase()));
  }

  private getDestinationTypesForZoom(zoom: number): string[] {
    switch (zoom) {
      case 3:
      case 4:
      case 5:
      case 6:
      case 7:
        return ['COUNTRY'];
      case 8:
        return [
          'REGION',
          'STATE',
          'PROVINCE',
          'COUNTY',
          'CITY',
          'TOWN',
          'VILLAGE',
          'METRO',
          'NEIGHBORHOOD',
          'DISTRICT'
        ];
      default:
        return ['CITY', 'TOWN', 'VILLAGE', 'METRO', 'NEIGHBORHOOD', 'DISTRICT'];
    }
  }
}
