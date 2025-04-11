import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, map, Observable, throwError } from 'rxjs';
import { Oembed } from '../interfaces/oembed';

@Injectable({
  providedIn: 'root'
})
export class OembedService {

  constructor(
    private http: HttpClient
  ) { }

  private handleError(error: HttpErrorResponse) {
    return throwError(() => error);
  }

  private getEmbedCode(provider_url: string, sourceUrl: string): Observable<Oembed> {
    return this.http.get<Oembed>(`${provider_url}?url=${sourceUrl}`)
      .pipe(
        catchError(this.handleError)
      );
  }

  public getYoutubeEmbedCode(sourceUrl: string): Observable<Oembed> {
    return this.getEmbedCode('https://www.youtube.com/oembed', sourceUrl)
      .pipe(
        map((oembed: Oembed) => {
          oembed.html = oembed.html?.replace(/width="\d+"/g, 'width="100%" style="aspect-ratio: 16 / 9; resize: both; https://www.tiktok.com/@edsheeran/video/7489881587987827990?lang=de-DE"');
          oembed.html = oembed.html?.replace(/height="\d+"/g, '"');
          return oembed;
        }),
      );
  }

  public getTikTokEmbedCode(videoId: string): string {
    return `<iframe width= "100%" style="aspect-ratio: 16 / 9; resize: both; border: none;" src="https://www.tiktok.com/player/v1/${videoId}" allow="fullscreen" title="test"></iframe>`
  }

}
