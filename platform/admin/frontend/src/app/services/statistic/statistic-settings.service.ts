import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';
import { StatisticKeySetting } from '../../interfaces/statistic-key-setting.interface';

@Injectable({ providedIn: 'root' })
export class StatisticSettingsService {
  private readonly baseUrl = `${environment.apiUrl}/statistic/settings`;

  constructor(private http: HttpClient) { }

  list(): Observable<{ status: number; settings: StatisticKeySetting[] }> {
    return this.http.get<{ status: number; settings: StatisticKeySetting[] }>(this.baseUrl);
  }

  save(settings: StatisticKeySetting[]): Observable<{ status: number; ok: boolean }> {
    return this.http.put<{ status: number; ok: boolean }>(this.baseUrl, { settings });
  }
}

