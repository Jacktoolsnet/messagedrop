import { HttpClient, HttpParams } from '@angular/common/http';
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
    const params = new HttpParams()
      .set('searchTerm', searchTerm.trim())
      .set('limit', String(limit));

    return this.http
      .get<NominatimSearchResponse>(`${environment.apiUrl}/nominatim/search`, { params })
      .pipe(map((response) => response.result ?? []));
  }
}
