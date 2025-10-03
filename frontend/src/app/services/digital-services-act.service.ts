import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, Observable, throwError } from 'rxjs';
import { environment } from '../../environments/environment';

import { NetworkService } from './network.service';

// deine Interfaces (ggf. Pfade anpassen)
import { CreateDsaNotice } from '../interfaces/create-dsa-notice.interface';
import { CreateDsaSignal } from '../interfaces/create-dsa-signal.interface';

@Injectable({
  providedIn: 'root'
})
export class DigitalServicesActService {
  private httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json',
      'X-API-Authorization': `${environment.apiToken}`
    }),
    withCredentials: true
  };

  constructor(
    private http: HttpClient,
    private snackBar: MatSnackBar,
    private networkService: NetworkService
  ) { }

  private handleError(error: HttpErrorResponse) {
    return throwError(() => error);
  }

  /**
   * Quick-Report (Signal) absenden
   * POST {apiUrl}/dsa/signals
   */
  submitSignal(payload: CreateDsaSignal): Observable<{ id: string }> {
    const url = `${environment.apiUrl}/digitalserviceact/signals`;

    this.networkService.setNetworkMessageConfig(url, {
      showAlways: false,
      title: 'DSA',
      image: '',
      icon: '',
      message: 'Sending quick report…',
      button: '',
      delay: 0,
      showSpinner: true
    });

    const body = {
      contentId: payload.contentId,
      contentUrl: payload.contentUrl,
      category: payload.category,
      reasonText: payload.reasonText,
      reportedContentType: payload.contentType,
      reportedContent: payload.content
    };

    console.log(body);
    return this.http.post<{ id: string }>(url, body, this.httpOptions)
      .pipe(catchError(this.handleError));
  }

  /**
   * Formale DSA-Notice absenden
   * POST {apiUrl}/dsa/notices
   */
  submitNotice(payload: CreateDsaNotice): Observable<{ id: string }> {
    const url = `${environment.apiUrl}/digitalserviceact/notices`;

    this.networkService.setNetworkMessageConfig(url, {
      showAlways: false,
      title: 'DSA',
      image: '',
      icon: '',
      message: 'Submitting DSA notice…',
      button: '',
      delay: 0,
      showSpinner: true
    });

    // Body entsprechend unserer Backend-Route (alle Felder optional außer contentId)
    const body: any = {
      contentId: payload.contentId,
      contentUrl: payload.contentUrl,
      category: payload.category,
      reasonText: payload.reasonText,
      reporterEmail: payload.email,
      reporterName: payload.name,
      truthAffirmation: payload.truthAffirmation,
      reportedContentType: payload.contentType,
      reportedContent: payload.content
    };

    return this.http.post<{ id: string }>(url, body, this.httpOptions)
      .pipe(catchError(this.handleError));
  }

}