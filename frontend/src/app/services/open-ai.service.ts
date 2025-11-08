import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { Message } from '../interfaces/message';
import { NetworkService } from './network.service';

interface ModerationResult {
  flagged: boolean;
  [key: string]: unknown;
}

interface OpenAiModerationResponse {
  results: ModerationResult[];
  [key: string]: unknown;
}

@Injectable({
  providedIn: 'root'
})
export class OpenAiService {

  httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json',
      'X-API-Authorization': `${environment.apiToken}`,
      withCredentials: 'true'
    })
  };

  private readonly networkService = inject(NetworkService);
  private readonly http = inject(HttpClient);

  private handleError(error: HttpErrorResponse) {
    return throwError(() => error);
  }

  public moderateMessage(message: Message, showAlways = false): Observable<OpenAiModerationResponse> {
    const url = `${environment.apiUrl}/openai/moderate`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: showAlways,
      title: 'Moderation service',
      image: '',
      icon: '',
      message: `Moderating message using OpenAI moderation AI`,
      button: '',
      delay: 0,
      showSpinner: true
    });
    const body = {
      'message': message.message
    };
    return this.http.post<OpenAiModerationResponse>(url, body, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      )
  }
}
