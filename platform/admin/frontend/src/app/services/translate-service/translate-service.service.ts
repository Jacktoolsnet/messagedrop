import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class TranslateService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/translate`;

  /** Übersetzt Text nach Deutsch über das Admin-Backend (DeepL). */
  translateToGerman(text: string) {
    const url = `${this.baseUrl}/DE/${encodeURIComponent(text)}`;
    return this.http.get<DeeplResponse>(url).pipe(
      map(res => {
        if (Array.isArray(res.result)) return res.result.map(r => r.text).join('\n');
        return res.result?.text ?? '';
      })
    );
  }
}