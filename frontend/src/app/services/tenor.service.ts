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
      'Content-Type': 'application/json'
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
   * Constructs a URL with query parameters.
   * 
   * @param baseUrl - The base URL to which query parameters will be appended.
   * @param map - A map containing key-value pairs of query parameters.
   * @returns A string representing the complete URL with encoded query parameters.
   */
  private createUrl(baseUrl: string, map: Map<string, string>): string {
    let result = baseUrl + "?";
    map.forEach((value, key) => {
      result += `${encodeURIComponent(key)}=${encodeURIComponent(value)}&`;
    });
    return result.slice(0, -1);
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
  getFeaturedGifs(next: string): Observable<any> {
    let parameters: Map<string, string> = new Map();
    parameters.set('key', environment.tenor_api_key);
    parameters.set('client_key', environment.tenor_client_key);
    parameters.set('country', this.userService.getUser().language);
    parameters.set('locale', this.userService.getUser().locale.replace('-', '_'));
    parameters.set('media_filter', 'gif')
    parameters.set('ar_range', 'standard');
    parameters.set('contentfilter', 'low');
    parameters.set('limit', '30');
    if (next != '') {
      parameters.set('pos', next);
    }

    let url: string = this.createUrl(`${environment.tenor_base_url}/featured`, parameters);
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: false,
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
  searchGifs(searchTerm: string, next: string): Observable<any> {
    let parameters: Map<string, string> = new Map();
    parameters.set('key', environment.tenor_api_key);
    parameters.set('client_key', environment.tenor_client_key);
    parameters.set('q', searchTerm);
    parameters.set('country', this.userService.getUser().language);
    parameters.set('locale', this.userService.getUser().locale.replace('-', '_'));
    parameters.set('media_filter', 'gif')
    parameters.set('ar_range', 'standard');
    parameters.set('contentfilter', 'low');
    parameters.set('limit', '30');
    if (next != '') {
      parameters.set('pos', next);
    }

    let url: string = this.createUrl(`${environment.tenor_base_url}/search`, parameters);
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: false,
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
