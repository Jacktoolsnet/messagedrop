import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { BoundingBox } from '../interfaces/bounding-box';
import { Location } from '../interfaces/location';
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

  async getDestinationById(id: number): Promise<ViatorDestinationLookup | undefined> {
    if (!id) return undefined;
    await this.ensureDestinationsLoaded();
    return this.destinations.find((dest) => dest.destinationId === id);
  }

  async getDestinationForLocation(location: Location): Promise<ViatorDestinationLookup | null> {
    if (!location) return null;
    await this.ensureDestinationsLoaded();
    if (!this.destinations.length) return null;

    const normalizedLocation = this.normalizePlusCode(location.plusCode);
    let best: ViatorDestinationLookup | null = null;
    let bestLength = 0;

    if (normalizedLocation) {
      for (const destination of this.destinations) {
        const normalizedDestination = this.normalizePlusCode(destination.plusCode);
        if (!normalizedDestination) continue;
        if (normalizedLocation.startsWith(normalizedDestination) && normalizedDestination.length > bestLength) {
          best = destination;
          bestLength = normalizedDestination.length;
        }
      }
    }

    if (best) {
      return best;
    }

    const centerCandidates = this.destinations.filter((dest) =>
      Number.isFinite(dest.center?.latitude) && Number.isFinite(dest.center?.longitude)
    );
    if (!centerCandidates.length) return null;

    let nearest: ViatorDestinationLookup | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const destination of centerCandidates) {
      const lat = destination.center?.latitude ?? 0;
      const lng = destination.center?.longitude ?? 0;
      const distance = this.getDistanceInMeters(location.latitude, location.longitude, lat, lng);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = destination;
      }
    }
    return nearest;
  }

  private normalizePlusCode(value?: string): string {
    if (!value) return '';
    return value.replace(/\+/g, '').trim().toUpperCase();
  }

  private getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const toRad = (deg: number) => deg * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2)
      + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2))
      * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}
