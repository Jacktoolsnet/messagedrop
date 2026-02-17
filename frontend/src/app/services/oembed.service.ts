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
    'tiktok.com',
    'vm.tiktok.com',
    'pinterest.com',
    'pin.it',
    'open.spotify.com'
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
    return this.isAllowedHost(this.getHostname(url), ['youtube.com', 'youtu.be']);
  }

  private isTikTokUrl(url: string): boolean {
    return this.isAllowedHost(this.getHostname(url), ['tiktok.com', 'vm.tiktok.com']);
  }

  private isPinterestUrl(url: string): boolean {
    return this.isAllowedHost(this.getHostname(url), ['pinterest.com', 'pin.it']);
  }

  private isSpotifyUrl(url: string): boolean {
    return this.isAllowedHost(this.getHostname(url), ['open.spotify.com']);
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
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)([?=a-zA-Z0-9_-]+)/;
    const youtubeMatch = url.match(youtubeRegex);
    if (youtubeMatch && youtubeMatch[5]) {
      try {
        const response = await firstValueFrom(this.getYoutubeEmbedCode(url));
        return {
          type: MultimediaType.YOUTUBE,
          url: '',
          contentId: null != youtubeMatch[5] ? youtubeMatch[5] : '',
          sourceUrl: url,
          attribution: this.poweredBy('YouTube'),
          title: '',
          description: '',
          oembed: response.result
        };
      } catch (error) {
        console.error('Failed to load YouTube embed data', error);
        return undefined;
      }
    } else {
      return undefined;
    }
  }

  private async getTikTokMultimedia(url: string): Promise<Multimedia | undefined> {
    const tiktokRegex = /^(https?:\/\/)?(www\.)?tiktok\.com\/@[\w.-]+\/video\/(\d+)/;
    const tiktokMatch = url.match(tiktokRegex);
    const tiktokVmRegex = /^(https?:\/\/)?vm\.tiktok\.com\/([a-zA-Z0-9]+)\/?/;
    const tiktokVmMatch = url.match(tiktokVmRegex);
    const tiktokShortRegex = /^(https?:\/\/)?(www\.)?tiktok\.com\/t\/([a-zA-Z0-9]+)\/?/;
    const tiktokShortMatch = url.match(tiktokShortRegex);

    if (tiktokMatch && tiktokMatch[3]) {
      const tiktokId = tiktokMatch[3];
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
    } else if ((tiktokVmMatch && tiktokVmMatch[2]) || (tiktokShortMatch && tiktokShortMatch[3])) {
      try {
        const response = await firstValueFrom(this.getTikTokVmEmbedCode(url));
        const regex = /cite=["']([^"']+)["']/i;
        const match = response.result.html?.match(regex);
        if (match && match[1]) {
          url = match[1];
          return await this.getTikTokMultimedia(url);
        } else {
          return undefined;
        }
      } catch (error) {
        console.error('Failed to resolve TikTok short URL', error);
        return undefined;
      }
    }

    return undefined;
  }

  private async getPinterestMultimedia(url: string): Promise<Multimedia | undefined> {
    const pinterestRegex = /pinterest\.[a-z]{2,3}(\.[a-z]{2,3})?\/pin\/.*-([^/]+)/i;
    const pinterestMatch = url.match(pinterestRegex);
    const pinterestShortRegex = /https:\/\/pin\.it\/([a-zA-Z0-9]+)/;
    const pinterestShortMatch = url.match(pinterestShortRegex);
    const pinterestFinalRegex = /pinterest\.[a-z]{2,3}(\.[a-z]{2,3})?\/pin\/(\d+)/i;
    const pinterestFinalMatch = url.match(pinterestFinalRegex);

    if (pinterestShortMatch) {
      try {
        const firstResponse = await firstValueFrom(this.resolveRedirectUrl(url));
        const finalResponse = await firstValueFrom(this.resolveRedirectUrl(firstResponse.result));
        const regex = /^(https?:\/\/)?(www\.)?pinterest\.[a-z]{2,3}\/pin\/\d+/;
        const match = finalResponse.result.match(regex);

        if (match) {
          const resolvedUrl = match[0].replace(/pinterest\.[a-z]{2,3}/, 'pinterest.com');
          return await this.getPinterestMultimedia(resolvedUrl);
        }
      } catch (error) {
        console.error('Failed to resolve Pinterest short URL', error);
        return undefined;
      }
    } else if (pinterestMatch && pinterestMatch[2]) {
      const normalizedUrl = url.substring(0, url.indexOf('/pin/') + 5) + pinterestMatch[2];
      return await this.getPinterestMultimedia(normalizedUrl);
    } else if (pinterestFinalMatch && pinterestFinalMatch[2]) {
      try {
        const response = await firstValueFrom(this.getPinterestEmbedCode(url));
        return {
          type: MultimediaType.PINTEREST,
          url: '',
          contentId: pinterestFinalMatch[2],
          sourceUrl: url,
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
    return undefined;
  }

  private async getSpotifyMultimedia(url: string): Promise<Multimedia | undefined> {
    const spotifyRegex = /https?:\/\/open\.spotify\.com\/(track|album|artist|playlist)\/([a-zA-Z0-9]+)/;
    const spotifyMatch = url.match(spotifyRegex);

    if (spotifyMatch && spotifyMatch[2]) {
      try {
        const response = await firstValueFrom(this.getSpotifyEmbedCode(spotifyMatch[0]));
        return {
          type: MultimediaType.SPOTIFY,
          url: '',
          contentId: spotifyMatch[2],
          sourceUrl: spotifyMatch[0],
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

    return undefined;
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
