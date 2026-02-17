import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, firstValueFrom, map, Observable, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { GetOembedResponse } from '../interfaces/get-oembed-response';
import { Location } from '../interfaces/location';
import { Multimedia } from '../interfaces/multimedia';
import { MultimediaType } from '../interfaces/multimedia-type';
import { GeolocationService } from './geolocation.service';
import { TranslationHelperService } from './translation-helper.service';

interface ResolveRedirectResponse {
  result: string;
}

@Injectable({
  providedIn: 'root'
})
export class OembedService {
  private readonly http = inject(HttpClient);
  private readonly geolocationService = inject(GeolocationService);
  private readonly translation = inject(TranslationHelperService);
  private readonly allowedOembedHosts = [
    'youtube.com',
    'youtu.be',
    'youtube-nocookie.com',
    'tiktok.com',
    'pinterest.com',
    'pin.it',
    'open.spotify.com',
    'spotify.com',
    'spotify.link',
    'spotify.app.link',
    'spoti.fi'
  ];
  private readonly allowedGoogleMapsHosts = ['maps.app.goo.gl'];

  httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json',
      withCredentials: 'true'
    })
  };

  private handleError(error: HttpErrorResponse) {
    return throwError(() => error);
  }

  public isLocation(obj: unknown): obj is Location {
    if (typeof obj !== 'object' || obj === null) {
      return false;
    }
    const candidate = obj as Partial<Location>;
    return typeof candidate.latitude === 'number'
      && typeof candidate.longitude === 'number'
      && typeof candidate.plusCode === 'string';
  }

  public isMultimedia(obj: unknown): obj is Multimedia {
    if (typeof obj !== 'object' || obj === null) {
      return false;
    }
    const candidate = obj as Partial<Multimedia>;
    return typeof candidate.sourceUrl === 'string' && typeof candidate.type === 'string';
  }

  resolveRedirectUrl(url: string): Observable<ResolveRedirectResponse> {
    return this.http.get<ResolveRedirectResponse>(`${environment.apiUrl}/utils/resolve/${encodeURIComponent(url)}`, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      )
  }

  public async getObjectFromUrl(url: string): Promise<Multimedia | Location | undefined> {
    if (this.isYouTubeUrl(url)) {
      return await this.getYouTubeMultimedia(url);
    }
    if (this.isTikTokUrl(url)) {
      return await this.getTikTokMultimedia(url);
    }
    if (this.isPinterestUrl(url)) {
      return await this.getPinterestMultimedia(url);
    }
    if (this.isSpotifyUrl(url)) {
      return await this.getSpotifyMultimedia(url);
    }
    if (this.isGoogleMapsUrl(url)) {
      return await this.getGoogleMapsLocation(url);
    }
    return undefined;
  }

  public isAllowedOembedSource(sourceUrl?: string, providerUrl?: string): boolean {
    const sourceHost = this.getHostname(sourceUrl);
    const providerHost = this.getHostname(providerUrl);
    return this.isAllowedHost(sourceHost, this.allowedOembedHosts)
      || this.isAllowedHost(providerHost, this.allowedOembedHosts);
  }

  private isYouTubeUrl(url: string): boolean {
    const host = this.getHostname(url);
    if (!host) {
      return false;
    }
    return this.isAllowedHost(host, ['youtube.com', 'youtu.be', 'youtube-nocookie.com']);
  }

  private isTikTokUrl(url: string): boolean {
    return this.isAllowedHost(this.getHostname(url), ['tiktok.com']);
  }

  private isPinterestUrl(url: string): boolean {
    const host = this.getHostname(url);
    if (!host) {
      return false;
    }
    if (this.isAllowedHost(host, ['pin.it'])) {
      return true;
    }
    return /^([a-z0-9-]+\.)*pinterest\.[a-z]{2,3}(?:\.[a-z]{2,3})?$/i.test(host);
  }

  private isSpotifyUrl(url: string): boolean {
    return this.isAllowedHost(this.getHostname(url), ['open.spotify.com', 'spotify.com', 'spotify.link', 'spotify.app.link', 'spoti.fi']);
  }

  private isGoogleMapsUrl(url: string): boolean {
    return this.isAllowedHost(this.getHostname(url), this.allowedGoogleMapsHosts);
  }

  private getHostname(url?: string): string | undefined {
    if (!url) return undefined;
    try {
      return new URL(url).hostname.toLowerCase();
    } catch {
      return undefined;
    }
  }

  private isAllowedHost(host: string | undefined, allowedHosts: string[]): boolean {
    if (!host) return false;
    return allowedHosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
  }

  private poweredBy(platform: string): string {
    return this.translation.t('common.multimedia.attributionPoweredBy', { platform });
  }

  public async getGoogleMapsLocation(url: string): Promise<Location | undefined> {
    try {
      let currentUrl = url;
      let attempts = 0;

      while (attempts < 4) {
        // Prüfe sofort nach der Auflösung, ob Koordinaten enthalten sind
        const coordPatterns = [
          /@(-?\d+\.\d+),(-?\d+\.\d+)/,
          /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
          /\/place\/[^/]*\/@(-?\d+\.\d+),(-?\d+\.\d+)/,
        ];

        for (const pattern of coordPatterns) {
          const match = currentUrl.match(pattern);
          if (match) {
            const lat = parseFloat(match[1]);
            const lon = parseFloat(match[2]);
            return {
              latitude: lat,
              longitude: lon,
              plusCode: this.geolocationService.getPlusCode(lat, lon),
            };
          }
        }

        // Wenn keine Koordinaten gefunden wurden: Weiterleiten
        const response = await firstValueFrom(this.resolveRedirectUrl(currentUrl));
        if (!response.result || response.result === currentUrl) {
          break; // keine neue URL mehr
        }
        currentUrl = response.result;
        attempts++;
      }
    } catch (err) {
      console.error('Failed to resolve Google Maps location', err);
    }

    return undefined;
  }

  private async getYouTubeMultimedia(url: string): Promise<Multimedia | undefined> {
    const videoId = this.extractYouTubeVideoId(url);
    if (!videoId) {
      return undefined;
    }
    const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;
    try {
      const response = await firstValueFrom(this.getYoutubeEmbedCode(canonicalUrl));
      return {
        type: MultimediaType.YOUTUBE,
        url: '',
        contentId: videoId,
        sourceUrl: canonicalUrl,
        attribution: this.poweredBy('YouTube'),
        title: '',
        description: '',
        oembed: response.result
      };
    } catch (error) {
      console.error('Failed to load YouTube embed data', error);
      return undefined;
    }
  }

  private async getTikTokMultimedia(url: string, depth = 0): Promise<Multimedia | undefined> {
    const tiktokId = this.extractTikTokVideoId(url);
    if (tiktokId) {
      const oembedHtml = this.getTikTokEmbedCode(tiktokId);
      return {
        type: MultimediaType.TIKTOK,
        url: '',
        contentId: null != tiktokId ? tiktokId : '',
        sourceUrl: url,
        attribution: this.poweredBy('TikTok'),
        title: '',
        description: '',
        oembed: {
          html: oembedHtml,
          width: 0,
          height: 0,
          provider_name: 'TikTok',
          provider_url: 'https://www.tiktok.com/',
          type: 'rich',
          version: '1.0'
        }
      };
    }
    if (depth >= 4) {
      return undefined;
    }
    try {
      const response = await firstValueFrom(this.getTikTokVmEmbedCode(url));
      const citeUrl = this.extractCiteUrl(response.result?.html);
      if (citeUrl && citeUrl !== url) {
        return await this.getTikTokMultimedia(citeUrl, depth + 1);
      }
    } catch (error) {
      console.error('Failed to resolve TikTok short URL', error);
    }
    return undefined;
  }

  private async getPinterestMultimedia(url: string): Promise<Multimedia | undefined> {
    const normalizedUrl = url.trim();
    const pinterestShortRegex = /^https?:\/\/(?:www\.)?pin\.it\/([a-zA-Z0-9_-]+)/i;
    const pinterestShortMatch = normalizedUrl.match(pinterestShortRegex);

    if (pinterestShortMatch && pinterestShortMatch[1]) {
      const shortCode = pinterestShortMatch[1];
      let sourceUrl = normalizedUrl;
      let contentId = shortCode;

      try {
        const resolvedUrl = await this.resolveRedirectChain(normalizedUrl, 6);
        const resolvedPinId = this.extractPinterestPinId(resolvedUrl);
        if (resolvedPinId) {
          contentId = resolvedPinId;
          sourceUrl = `https://www.pinterest.com/pin/${resolvedPinId}`;
        }
      } catch (error) {
        console.error('Failed to resolve Pinterest short URL', error);
      }

      try {
        const response = await firstValueFrom(this.getPinterestEmbedCode(sourceUrl));
        return {
          type: MultimediaType.PINTEREST,
          url: '',
          contentId,
          sourceUrl,
          attribution: this.poweredBy('Pinterest'),
          title: '',
          description: '',
          oembed: response.result
        };
      } catch (error) {
        console.error('Failed to fetch Pinterest embed data', error);
        return undefined;
      }
    }

    const pinId = this.extractPinterestPinId(normalizedUrl);
    if (!pinId) {
      return undefined;
    }

    const canonicalUrl = `https://www.pinterest.com/pin/${pinId}`;
    try {
      const response = await firstValueFrom(this.getPinterestEmbedCode(canonicalUrl));
      return {
        type: MultimediaType.PINTEREST,
        url: '',
        contentId: pinId,
        sourceUrl: canonicalUrl,
        attribution: this.poweredBy('Pinterest'),
        title: '',
        description: '',
        oembed: response.result
      };
    } catch (error) {
      console.error('Failed to fetch Pinterest embed data', error);
      return undefined;
    }
  }

  private async resolveRedirectChain(url: string, maxRedirects = 4): Promise<string> {
    let currentUrl = url;
    for (let i = 0; i < maxRedirects; i++) {
      const response = await firstValueFrom(this.resolveRedirectUrl(currentUrl));
      const nextUrl = typeof response.result === 'string' ? response.result.trim() : '';
      if (!nextUrl || nextUrl === currentUrl) {
        break;
      }
      currentUrl = nextUrl;
    }
    return currentUrl;
  }

  private extractPinterestPinId(url: string): string | null {
    const pinterestPinRegex = /pinterest\.[a-z]{2,3}(?:\.[a-z]{2,3})?\/pin\/(?:[^/?#]*-)?(\d+)/i;
    const match = url.match(pinterestPinRegex);
    if (!match || !match[1]) {
      return null;
    }
    return match[1];
  }

  private async getSpotifyMultimedia(url: string): Promise<Multimedia | undefined> {
    const normalizedUrl = url.trim();
    const host = this.getHostname(normalizedUrl);
    let canonical = this.extractSpotifyCanonical(normalizedUrl);
    const shouldResolve = !!host && host !== 'open.spotify.com' && this.isAllowedHost(host, ['spotify.com', 'spotify.link', 'spotify.app.link', 'spoti.fi']);
    if (!canonical && shouldResolve) {
      try {
        const resolvedUrl = await this.resolveRedirectChain(normalizedUrl, 6);
        canonical = this.extractSpotifyCanonical(resolvedUrl);
      } catch (error) {
        console.error('Failed to resolve Spotify URL', error);
      }
    }

    if (!canonical) {
      try {
        const response = await firstValueFrom(this.getSpotifyEmbedCode(normalizedUrl));
        return {
          type: MultimediaType.SPOTIFY,
          url: '',
          contentId: '',
          sourceUrl: normalizedUrl,
          attribution: this.poweredBy('Spotify'),
          title: '',
          description: '',
          oembed: response.result
        };
      } catch (error) {
        console.error('Failed to load Spotify embed data', error);
        return undefined;
      }
    }

    try {
      const response = await firstValueFrom(this.getSpotifyEmbedCode(canonical.sourceUrl));
      return {
        type: MultimediaType.SPOTIFY,
        url: '',
        contentId: canonical.contentId,
        sourceUrl: canonical.sourceUrl,
        attribution: this.poweredBy('Spotify'),
        title: '',
        description: '',
        oembed: response.result
      };
    } catch (error) {
      console.error('Failed to load Spotify embed data', error);
      return undefined;
    }
  }

  private extractYouTubeVideoId(url: string): string | null {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return null;
    }

    const host = parsedUrl.hostname.toLowerCase();
    if (this.isAllowedHost(host, ['youtu.be'])) {
      const id = parsedUrl.pathname.split('/').filter(Boolean)[0];
      return id || null;
    }

    if (!this.isAllowedHost(host, ['youtube.com', 'youtube-nocookie.com'])) {
      return null;
    }

    const pathSegments = parsedUrl.pathname.split('/').filter(Boolean);
    if (pathSegments[0] === 'watch') {
      const id = parsedUrl.searchParams.get('v');
      return id ? id.trim() : null;
    }
    if ((pathSegments[0] === 'shorts' || pathSegments[0] === 'embed' || pathSegments[0] === 'live') && pathSegments[1]) {
      return pathSegments[1];
    }
    return null;
  }

  private extractTikTokVideoId(url: string): string | null {
    const tiktokRegex = /tiktok\.com\/@[\w.-]+\/video\/(\d+)/i;
    const match = url.match(tiktokRegex);
    if (!match || !match[1]) {
      return null;
    }
    return match[1];
  }

  private extractCiteUrl(html?: string): string | null {
    if (!html) {
      return null;
    }
    const regex = /cite=["']([^"']+)["']/i;
    const match = html.match(regex);
    if (!match || !match[1]) {
      return null;
    }
    return match[1];
  }

  private extractSpotifyCanonical(url: string): { sourceUrl: string, contentId: string } | null {
    const spotifyRegex = /^https?:\/\/open\.spotify\.com\/(track|album|artist|playlist|episode|show)\/([a-zA-Z0-9]+)(?:[/?#].*)?$/i;
    const match = url.trim().match(spotifyRegex);
    if (!match || !match[1] || !match[2]) {
      return null;
    }
    return {
      sourceUrl: `https://open.spotify.com/${match[1].toLowerCase()}/${match[2]}`,
      contentId: match[2]
    };
  }

  public getYoutubeEmbedCode(sourceUrl: string): Observable<GetOembedResponse> {
    const providerUrl = encodeURIComponent('https://www.youtube.com/oembed');
    const targetUrl = encodeURIComponent(sourceUrl);
    return this.http.get<GetOembedResponse>(`${environment.apiUrl}/utils/oembed?provider=${providerUrl}&url=${targetUrl}`, this.httpOptions)
      .pipe(
        map((response: GetOembedResponse) => {
          return response;
        }),
      )
      .pipe(
        catchError(this.handleError)
      )
  }

  public getTikTokEmbedCode(videoId: string): string {
    return `<iframe width= "auto" style="aspect-ratio: 16 / 9; resize: both; border: none;" src="https://www.tiktok.com/player/v1/${videoId}" allow="fullscreen" title="test"></iframe>`
  }

  public getTikTokVmEmbedCode(sourceUrl: string): Observable<GetOembedResponse> {
    const providerUrl = encodeURIComponent('https://www.tiktok.com/oembed');
    const targetUrl = encodeURIComponent(sourceUrl);
    return this.http.get<GetOembedResponse>(`${environment.apiUrl}/utils/oembed?provider=${providerUrl}&url=${targetUrl}`, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      )
  }

  public getPinterestEmbedCode(sourceUrl: string): Observable<GetOembedResponse> {
    const providerUrl = encodeURIComponent('https://www.pinterest.com/oembed.json');
    const targetUrl = encodeURIComponent(sourceUrl);
    return this.http.get<GetOembedResponse>(`${environment.apiUrl}/utils/oembed?provider=${providerUrl}&url=${targetUrl}`, this.httpOptions)
      .pipe(
        map((response: GetOembedResponse) => {
          return response;
        }),
      )
      .pipe(
        catchError(this.handleError)
      )
  }

  public getSpotifyEmbedCode(sourceUrl: string): Observable<GetOembedResponse> {
    const providerUrl = encodeURIComponent('https://open.spotify.com/oembed');
    const targetUrl = encodeURIComponent(sourceUrl);
    return this.http.get<GetOembedResponse>(`${environment.apiUrl}/utils/oembed?provider=${providerUrl}&url=${targetUrl}`, this.httpOptions)
      .pipe(
        map((response: GetOembedResponse) => {
          //response.result.html = response.result.html?.replace(/width="\d+"/g, 'width="100%" style="aspect-ratio: 16 / 9; resize: both;"');
          //response.result.html = response.result.html?.replace(/height="\d+"/g, '"');
          return response;
        }),
      )
      .pipe(
        catchError(this.handleError)
      )
  }

}
