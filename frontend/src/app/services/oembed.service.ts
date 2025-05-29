import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, firstValueFrom, map, Observable, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { GetOembedResponse } from '../interfaces/get-oembed-response';
import { Location } from '../interfaces/location';
import { Multimedia } from '../interfaces/multimedia';
import { MultimediaType } from '../interfaces/multimedia-type';
import { GeolocationService } from './geolocation.service';

@Injectable({
  providedIn: 'root'
})
export class OembedService {

  constructor(
    private http: HttpClient,
    private geolocationService: GeolocationService,
  ) { }

  httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${environment.apiToken}`,
      withCredentials: 'true'
    })
  };

  private handleError(error: HttpErrorResponse) {
    return throwError(() => error);
  }

  public isLocation(obj: any): obj is Location {
    return obj && typeof obj.latitude === 'number' && typeof obj.longitude === 'number' && typeof obj.plusCode === 'string';
  }

  public isMultimedia(obj: any): obj is Multimedia {
    return obj && typeof obj.sourceUrl === 'string' && 'type' in obj;
  }

  resolveRedirectUrl(url: string): Observable<any> {
    return this.http.get<any>(`${environment.apiUrl}/utils/resolve/${encodeURIComponent(url)}`, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      )
  }

  public async getObjectFromUrl(url: string): Promise<Multimedia | Location | undefined> {
    const lowerUrl = url.toLowerCase();

    if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) {
      return await this.getYouTubeMultimedia(url);
    }
    if (lowerUrl.includes('tiktok.com') || lowerUrl.includes('vm.tiktok.com')) {
      return await this.getTikTokMultimedia(url);
    }
    if (lowerUrl.includes('pinterest.com') || lowerUrl.includes('pin.it')) {
      return await this.getPinterestMultimedia(url);
    }
    if (lowerUrl.includes('spotify.com')) {
      return await this.getSpotifyMultimedia(url);
    }
    if (lowerUrl.includes('maps.app.goo.gl')) {
      return await this.getGoogleMapsLocation(url);
    }
    return undefined;
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
          /\/place\/[^\/]*\/@(-?\d+\.\d+),(-?\d+\.\d+)/,
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
    } catch (err) { }

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
          attribution: 'Powered by YouTube',
          title: '',
          description: '',
          oembed: response.result
        };
      } catch (error) {
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

    if (tiktokMatch && tiktokMatch[3]) {
      this.getTikTokEmbedCode(url)
      let tiktokId = tiktokMatch[3];
      let oembedHtml = this.getTikTokEmbedCode(tiktokId);
      return {
        type: MultimediaType.TIKTOK,
        url: '',
        contentId: null != tiktokId ? tiktokId : '',
        sourceUrl: url,
        attribution: 'Powered by TikTok',
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
    } else if (tiktokVmMatch && tiktokVmMatch[2]) {
      try {
        const response = await firstValueFrom(this.getTikTokVmEmbedCode(url));
        const regex = /<blockquote class="tiktok-embed" cite="([^"]+)"/;
        const match = response.result.html?.match(regex);
        if (match && match[1]) {
          url = match[1];
          return await this.getTikTokMultimedia(url);
        } else {
          return undefined;
        }
      } catch (error) {
        return undefined;
      }
    }

    return undefined;
  }

  private async getPinterestMultimedia(url: string): Promise<Multimedia | undefined> {
    const pinterestRegex = /pinterest\.[a-z]{2,3}(\.[a-z]{2,3})?\/pin\/.*-([^\/]+)/i;
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
          attribution: 'Powered by Pinterest',
          title: '',
          description: '',
          oembed: response.result
        };
      } catch (error) {
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
          attribution: 'Powered by Spotify',
          title: '',
          description: '',
          oembed: response.result
        };
      } catch (error) {
        return undefined;
      }
    }

    return undefined;
  }

  public getYoutubeEmbedCode(sourceUrl: string): Observable<GetOembedResponse> {
    return this.http.get<GetOembedResponse>(`${environment.apiUrl}/utils/oembed/${encodeURIComponent('https://www.youtube.com/oembed')}/${encodeURIComponent(sourceUrl)}`, this.httpOptions)
      .pipe(
        map((response: GetOembedResponse) => {
          response.result.html = response.result.html?.replace(/width="\d+"/g, 'width="100%" style="aspect-ratio: 16 / 9; resize: both;"');
          response.result.html = response.result.html?.replace(/height="\d+"/g, '"');
          return response;
        }),
      )
      .pipe(
        catchError(this.handleError)
      )
  }

  public getTikTokEmbedCode(videoId: string): string {
    return `<iframe width= "100%" style="aspect-ratio: 16 / 9; resize: both; border: none;" src="https://www.tiktok.com/player/v1/${videoId}" allow="fullscreen" title="test"></iframe>`
  }

  public getTikTokVmEmbedCode(sourceUrl: string): Observable<GetOembedResponse> {
    return this.http.get<GetOembedResponse>(`${environment.apiUrl}/utils/oembed/${encodeURIComponent('https://www.tiktok.com/oembed')}/${encodeURIComponent(sourceUrl)}`, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      )
  }

  public getPinterestEmbedCode(sourceUrl: string): Observable<GetOembedResponse> {
    return this.http.get<GetOembedResponse>(`${environment.apiUrl}/utils/oembed/${encodeURIComponent('https://www.pinterest.com/oembed.json')}/${encodeURIComponent(sourceUrl)}`, this.httpOptions)
      .pipe(
        map((response: GetOembedResponse) => {
          response.result.html = response.result.html?.replace(/width="\d+"/g, `style="width: ${response.result.width}; max-width: 100%; height: ${response.result.height! + 70}; aspect-ratio: ${response.result.width} / ${response.result.height! + 70}; resize: both;"`);
          response.result.html = response.result.html?.replace(/height="\d+"/g, '"');
          return response;
        }),
      )
      .pipe(
        catchError(this.handleError)
      )
  }

  public getSpotifyEmbedCode(sourceUrl: string): Observable<GetOembedResponse> {
    return this.http.get<GetOembedResponse>(`${environment.apiUrl}/utils/oembed/${encodeURIComponent('https://open.spotify.com/oembed')}/${encodeURIComponent(sourceUrl)}`, this.httpOptions)
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
