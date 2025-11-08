import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { NetworkService } from './network.service';
import { UserService } from './user.service';

@Injectable({
  providedIn: 'root'
})
export class TenorService {

  httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json',
      'X-API-Authorization': `${environment.apiToken}`,
      withCredentials: 'true'
    })
  };

  constructor(
    private http: HttpClient,
    private userService: UserService,
    private networkService: NetworkService,
  ) { }

  /**
   * Handles HTTP errors by wrapping the error in an observable.
   * 
   * @param error - The HTTP error response received from the API.
   * @returns An observable that throws the error for further handling.
   */
  private handleError(error: HttpErrorResponse) {
    return throwError(() => error);
  }

  /**
   * Fetches a list of featured GIFs from the Tenor API.
   * 
   * @param next - A string representing the pagination token for the next set of results. 
   *               If empty, the first page of results is fetched.
   * @returns An Observable containing the API response with the list of featured GIFs.
   * 
   * The method constructs the API URL dynamically using the `createUrl` helper method,
   * passing query parameters such as API keys, user locale, and content filters.
   * It then makes an HTTP GET request to the Tenor API and handles any errors using `handleError`.
   */
  getFeaturedGifs(next: string, showAlways = true): Observable<any> {

    const base = `${environment.apiUrl}/tenor/featured/${this.userService.getUser().language}/${this.userService.getUser().locale.replace('-', '_')}`;
    const url = !!next && next.trim().length > 0 ? `${base}/${encodeURIComponent(next)}` : base;

    this.networkService.setNetworkMessageConfig(url, {
      showAlways: showAlways,
      title: 'Tenor service',
      image: '',
      icon: '',
      message: `Loading`,
      button: '',
      delay: 0,
      showSpinner: true
    });
    return this.http.get<any>(url, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      )
  }

  /**
   * Searches for GIFs on the Tenor API based on a search term.
   * 
   * @param searchTerm - The term to search for GIFs.
   * @param next - A string representing the pagination token for the next set of results. 
   *               If empty, the first page of results is fetched.
   * @returns An Observable containing the API response with the list of GIFs matching the search term.
   * 
   * The method constructs the API URL dynamically using the `createUrl` helper method,
   * passing query parameters such as API keys, user locale, and content filters.
   * It then makes an HTTP GET request to the Tenor API and handles any errors using `handleError`.
   */
  searchGifs(searchTerm: string, next: string, showAlways = true): Observable<any> {

    const base = `${environment.apiUrl}/tenor/search/${this.userService.getUser().language}/${this.userService.getUser().locale.replace('-', '_')}/${encodeURIComponent(searchTerm)}`;
    const url = !!next && next.trim().length > 0 ? `${base}/${encodeURIComponent(next)}` : base;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: showAlways,
      title: 'Tenor service',
      image: '',
      icon: '',
      message: `Loading`,
      button: '',
      delay: 0,
      showSpinner: true
    });
    return this.http.get<any>(url, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      )
  }
}
