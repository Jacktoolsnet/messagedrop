import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { UserService } from './user.service';

@Injectable({
  providedIn: 'root'
})
export class TenorService {

  httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json'
    })
  };

  constructor(
    private http: HttpClient,
    private userService: UserService
  ) { }

  private handleError(error: HttpErrorResponse) {
    return throwError(() => error);
  }

  private createUrl(baseUrl: string, map: Map<string, string>): string {
    let result = baseUrl + "?";
    map.forEach((value, key) => {
      result += `${encodeURIComponent(key)}=${encodeURIComponent(value)}&`;
    });
    return result.slice(0, -1);
  }

  getFeatured(next: string): Observable<any> {
    let parameters: Map<string, string> = new Map();
    parameters.set('key', environment.tenor_api_key);
    parameters.set('client_key', environment.tenor_client_key);
    parameters.set('country', this.userService.getUser().language);
    parameters.set('locale', this.userService.getUser().local.replace('-', '_'));
    parameters.set('media_filter', 'gif')
    parameters.set('ar_range', 'standard');
    parameters.set('contentfilter', 'low');
    parameters.set('limit', '30');
    if (next != '') {
      parameters.set('pos', next);
    }

    let url: string = this.createUrl(`${environment.tenor_base_url}/featured`, parameters);
    console.log(url);
    return this.http.get<any>(url, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      )
  }
}
