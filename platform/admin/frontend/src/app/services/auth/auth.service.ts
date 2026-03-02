import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LoginRequest } from '../../interfaces/login-request.interface';
import { LoginResponse } from '../../interfaces/login-response.interface';
import { LoginOtpResponse } from '../../interfaces/login-otp-response.interface';
import { VerifyOtpRequest } from '../../interfaces/verify-otp-request.interface';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private _isLoggedIn = signal(!!localStorage.getItem('admin_token'));
  readonly isLoggedIn = this._isLoggedIn.asReadonly();

  readonly username = signal<string | null>(null);
  readonly role = signal<string | null>(null);

  private readonly baseUrl = `${environment.apiUrl}/user`;
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private get token() {
    return localStorage.getItem('admin_token');
  }
  private handleError = (error: unknown) => {
    this.snackBar.open('Login failed. Please check your credentials.', 'OK', {
      duration: 3000,
      panelClass: ['snack-error'],
      horizontalPosition: 'center',
      verticalPosition: 'top'
    });
    return throwError(() => error);
  };

  constructor() {
    if (this.token) {
      this._isLoggedIn.set(true);
      this.loadUserInfo();
    }
  }

  login(data: LoginRequest) {
    return this.http.post<LoginResponse | LoginOtpResponse>(`${this.baseUrl}/login`, data)
      .pipe(catchError(this.handleError));
  }

  verifyOtp(data: VerifyOtpRequest) {
    return this.http.post<LoginResponse>(`${this.baseUrl}/login/verify`, data)
      .pipe(catchError(this.handleError));
  }

  completeLogin(token: string) {
    localStorage.setItem('admin_token', token);
    this._isLoggedIn.set(true);
    this.loadUserInfo();
    this.router.navigate(['/dashboard']);
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

  loadUserInfo() {
    const token = localStorage.getItem('admin_token');
    if (!token) return;

    this.http.get<{ username: string; role: string }>(`${this.baseUrl}/me`, {
      headers: new HttpHeaders({
        Authorization: `Bearer ${token}`
      })
    }).subscribe({
      next: (data) => {
        this.username.set(data.username);
        this.role.set(data.role);
      },
      error: () => {
        this.username.set(null);
        this.role.set(null);
      }
    });
  }
}
