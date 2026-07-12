import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { WikipediaArticle, WikipediaNearbyRequest, WikipediaNearbyResponse, WikipediaResolvedAttribution } from '../interfaces/wikipedia';

@Injectable({ providedIn: 'root' })
export class WikipediaService {
  private readonly http = inject(HttpClient);
  private readonly silentHeaders = new HttpHeaders({
    'x-skip-ui': 'true',
    'x-skip-backend-status': 'true'
  });

  getNearby(request: WikipediaNearbyRequest): Observable<WikipediaNearbyResponse> {
    const params = new HttpParams()
      .set('north', request.north)
      .set('south', request.south)
      .set('east', request.east)
      .set('west', request.west)
      .set('zoom', request.zoom)
      .set('language', this.normalizeLanguage(request.language))
      .set('limit', request.limit ?? 100);

    return this.http.get<WikipediaNearbyResponse>(`${environment.apiUrl}/wikipedia/nearby`, {
      params,
      headers: this.silentHeaders
    });
  }

  normalizeLanguage(language: string): string {
    const normalized = language.trim().toLowerCase().split(/[-_]/u)[0];
    return /^[a-z]{2,3}$/u.test(normalized) ? normalized : 'en';
  }

  getAttribution(article: WikipediaArticle, language: string): Observable<WikipediaResolvedAttribution> {
    let params = new HttpParams()
      .set('pageId', article.pageId)
      .set('title', article.title)
      .set('language', this.normalizeLanguage(language));
    if (article.imageTitle) {
      params = params.set('imageTitle', article.imageTitle);
    }
    if (!article.summary.trim()) {
      params = params.set('needsSummary', true);
    }
    return this.http.get<WikipediaResolvedAttribution>(`${environment.apiUrl}/wikipedia/attribution`, {
      params,
      headers: this.silentHeaders
    });
  }
}
