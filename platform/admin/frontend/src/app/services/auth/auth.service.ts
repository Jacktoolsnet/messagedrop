import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LoginRequest } from '../../interfaces/login-request.interface';
import { LoginResponse } from '../../interfaces/login-response.interface';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private _isLoggedIn = signal(false);
  readonly isLoggedIn = this._isLoggedIn.asReadonly();

  private readonly baseUrl = `${environment.apiUrl}/user`;
  private get token() {
    return localStorage.getItem('admin_token');
  }

  private get httpOptions() {
    return {
      headers: new HttpHeaders({
        'Content-Type': 'application/json',
        ...(this.token ? { 'Authorization': `Bearer ${this.token}` } : {})
      })
    };
  }

  constructor(
    private http: HttpClient,
    private router: Router,
    private snackBar: MatSnackBar
  ) { }

  private handleError(error: any) {
    this.snackBar.open('Login failed. Please check your credentials.', 'OK', {
      duration: 3000,
      panelClass: ['snack-error'],
      horizontalPosition: 'center',
      verticalPosition: 'top'
    });
    return throwError(() => error);
  }

  login(data: LoginRequest) {
    return this.http.post<LoginResponse>(`${this.baseUrl}/login`, data, this.httpOptions)
      .pipe(catchError(this.handleError))
      .subscribe({
        next: (response) => {
          localStorage.setItem('admin_token', response.token);
          this._isLoggedIn.set(true);
          this.router.navigate(['/']); // Startseite
        },
        error: () => {
          this._isLoggedIn.set(false);
        }
      });
  }

  logout() {
    localStorage.removeItem('admin_token');
    this._isLoggedIn.set(false);
    this.router.navigate(['/login']);
  }

  /**
   * Hilfsfunktion: Token prüfen
   */
  hasToken(): boolean {
    return !!this.token;
  }
}