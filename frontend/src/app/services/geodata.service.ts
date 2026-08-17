import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map, of } from 'rxjs';
import { environment } from '../../environments/environment';
import { BoundingBox } from '../interfaces/bounding-box';
import {
  GeodataCategory,
  GeodataAvailability,
  GeodataAvailabilityResponse,
  GeodataNearbyResponse,
  GeodataPoi,
  GeodataSubcategory
} from '../interfaces/geodata';

@Injectable({ providedIn: 'root' })
export class GeodataService {
  private readonly http = inject(HttpClient);
  private readonly silentHeaders = new HttpHeaders({
    'x-skip-ui': 'true',
    'x-skip-backend-status': 'true'
  });
  getAvailability(): Observable<GeodataAvailability> {
    return this.http.get<GeodataAvailabilityResponse>(
      `${environment.apiUrl}/geodata/availability`,
      { headers: this.silentHeaders }
    ).pipe(map((response) => this.normalizeAvailability(response)));
  }

  getNearby(
    bounds: BoundingBox[],
    categories: Partial<Record<GeodataCategory, GeodataSubcategory[]>>,
    limit = 500
  ): Observable<GeodataPoi[]> {
    const activeCategories = Object.entries(categories)
      .filter((entry): entry is [GeodataCategory, GeodataSubcategory[]] => entry[1].length > 0);
    if (!bounds.length || !activeCategories.length) return of([]);

    const categoryNames = activeCategories.map(([category]) => category);
    const subcategories = Object.fromEntries(activeCategories);
    return forkJoin(bounds.map((box) => this.http.post<GeodataNearbyResponse>(
      `${environment.apiUrl}/geodata/nearby`,
      {
        bounds: { south: box.latMin, west: box.lonMin, north: box.latMax, east: box.lonMax },
        categories: categoryNames,
        subcategories,
        limit
      },
      { headers: this.silentHeaders }
    ))).pipe(map((responses) => {
      const unique = new Map<string, GeodataPoi>();
      responses.flatMap((response) => response.pois ?? []).forEach((poi) => unique.set(poi.id, poi));
      return [...unique.values()];
    }));
  }

  private normalizeAvailability(response: GeodataAvailabilityResponse): GeodataAvailability {
    const activeCategories = new Set(response.categories ?? []);
    return Object.fromEntries((Object.keys(response.subcategories ?? {}) as GeodataCategory[])
      .filter((category) => activeCategories.has(category))
      .map((category) => [category, response.subcategories?.[category] ?? []]));
  }
}
