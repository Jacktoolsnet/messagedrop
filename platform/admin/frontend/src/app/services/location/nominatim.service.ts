import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { NominatimPlace } from '../../interfaces/nominatim-place.interface';

interface NominatimSearchResponse {
  result?: NominatimPlace[];
}

@Injectable({
  providedIn: 'root'
})
export class NominatimService {
  private readonly http = inject(HttpClient);

  searchPlaces(searchTerm: string, limit = 10) {
    const encodedSearchTerm = encodeURIComponent(searchTerm.trim());
    return this.http
      .get<NominatimSearchResponse>(`${environment.apiUrl}/nominatim/search/${encodedSearchTerm}/${limit}`)
      .pipe(map((response) => response.result ?? []));
  }
}
