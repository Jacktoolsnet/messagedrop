import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';
import { Oembed } from '../interfaces/oembed';

@Injectable({
  providedIn: 'root'
})
export class OembedService {

  httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json'
    })
  };

  constructor(
    private http: HttpClient
  ) { }

  private handleError(error: HttpErrorResponse) {
    return throwError(() => error);
  }

  public getEmbedCode(provider_url: string, sourceUrl: string): Observable<Oembed> {
    return this.http.get<Oembed>(`${provider_url}?url=${sourceUrl}&format=json`, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      )
  }

}
