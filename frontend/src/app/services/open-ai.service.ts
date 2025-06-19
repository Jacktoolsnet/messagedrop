import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { Message } from '../interfaces/message';
import { NetworkService } from './network.service';

@Injectable({
  providedIn: 'root'
})
export class OpenAiService {

  httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${environment.apiToken}`,
      withCredentials: 'true'
    })
  };

  constructor(
    private networkService: NetworkService,
    private http: HttpClient
  ) { }

  private handleError(error: HttpErrorResponse) {
    return throwError(() => error);
  }

  public moderateMessage(message: Message, showAlways: boolean = false): Observable<any> {
    let url = `${environment.apiUrl}/openai/moderate`;
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
    let body = {
      'message': message.message
    };
    return this.http.post<any>(url, body, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      )
  }
}
