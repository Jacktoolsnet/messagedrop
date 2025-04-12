import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, map, Observable, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { GetOembedResponse } from '../interfaces/get-oembed-response';

@Injectable({
  providedIn: 'root'
})
export class OembedService {

  constructor(
    private http: HttpClient
  ) { }

  httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${environment.apiToken}`
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
          console.log('Pinterest response', response);
          response.result.html = response.result.html?.replace(/width="\d+"/g, `style="width: ${response.result.width}; max-width: 100%; height: ${response.result.height! + 70}; aspect-ratio: ${response.result.width} / ${response.result.height! + 70}; resize: both;"`);
          response.result.html = response.result.html?.replace(/height="\d+"/g, '"');
          return response;
        }),
      )
      .pipe(
        catchError(this.handleError)
      )
  }

}
