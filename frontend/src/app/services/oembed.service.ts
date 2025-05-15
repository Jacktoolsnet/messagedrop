import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { catchError, firstValueFrom, map, Observable, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { GetOembedResponse } from '../interfaces/get-oembed-response';
import { Multimedia } from '../interfaces/multimedia';
import { MultimediaType } from '../interfaces/multimedia-type';

@Injectable({
  providedIn: 'root'
})
export class OembedService {

  constructor(
    private http: HttpClient,
    private sanitizer: DomSanitizer
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

  resolveRedirectUrl(url: string): Observable<any> {
    return this.http.get<any>(`${environment.apiUrl}/utils/resolve/${encodeURIComponent(url)}`, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      )
  }

  public async getMultimediaFromUrl(url: string): Promise<Multimedia | undefined> {
    const lowerUrl = url.toLowerCase();

    if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) {
      return await this.getYouTubeMultimedia(url);
    }

    /*if (lowerUrl.includes('tiktok.com') || lowerUrl.includes('vm.tiktok.com')) {
      return await this.getTikTokMultimedia(url);
    }
  
    if (lowerUrl.includes('pinterest.com') || lowerUrl.includes('pin.it')) {
      return await this.getPinterestMultimedia(url);
    }
  
    if (lowerUrl.includes('spotify.com')) {
      return await this.getSpotifyMultimedia(url);
    }*/

    // Fallback für unbekannte Plattformen
    return undefined;
  }

  private async getYouTubeMultimedia(youtubeUrl: string): Promise<Multimedia | undefined> {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)([?=a-zA-Z0-9_-]+)/;
    const youtubeMatch = youtubeUrl.match(youtubeRegex);
    if (youtubeMatch && youtubeMatch[5]) {
      try {
        const response = await firstValueFrom(this.getYoutubeEmbedCode(youtubeUrl));
        return {
          type: MultimediaType.YOUTUBE,
          url: '',
          contentId: null != youtubeMatch[5] ? youtubeMatch[5] : '',
          sourceUrl: youtubeUrl,
          attribution: 'Powered by YouTube',
          title: '',
          description: '',
          oembed: response.result
        }
          ;
      } catch (error) {
        return undefined;
      }
    } else {
      return undefined;
    }
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
