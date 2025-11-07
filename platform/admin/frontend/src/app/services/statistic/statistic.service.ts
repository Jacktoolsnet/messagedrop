import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';
import { StatisticRangePreset } from '../../interfaces/statistic-range-preset.type';
import { MultiSeriesResponse } from '../../interfaces/statistic-multi-series-response.interface';

@Injectable({ providedIn: 'root' })
export class StatisticService {
  private readonly baseUrl = `${environment.apiUrl}/statistic`;
  private readonly http = inject(HttpClient);

  private get headers() {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'X-API-Authorization': environment.apiToken
    });
  }

  getKeys(): Observable<{ status: number; keys: string[] }> {
    return this.http.get<{ status: number; keys: string[] }>(`${this.baseUrl}/keys`, { headers: this.headers });
  }

  getSeriesForKeys(keys: string[], preset: StatisticRangePreset): Observable<MultiSeriesResponse> {
    let params = new HttpParams();
    if (keys.length) params = params.set('keys', keys.join(','));
    // Map 1d → days=1, sonst period
    if (preset === '1d') {
      params = params.set('days', '1');
    } else {
      const p = preset === '1w' ? '1w' : preset; // passt bereits
      params = params.set('period', p);
    }
    params = params.set('fill', 'true');

    return this.http.get<MultiSeriesResponse>(`${this.baseUrl}/series`, { headers: this.headers, params });
  }
}
