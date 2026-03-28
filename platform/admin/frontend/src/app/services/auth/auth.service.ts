import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LoginRequest } from '../../interfaces/login-request.interface';
import { LoginResponse } from '../../interfaces/login-response.interface';
import { LoginOtpResponse } from '../../interfaces/login-otp-response.interface';
import { VerifyOtpRequest } from '../../interfaces/verify-otp-request.interface';
import { TranslationHelperService } from '../translation-helper.service';
import { DisplayMessageService } from '../display-message.service';

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
  private readonly snackBar = inject(DisplayMessageService);
  private readonly i18n = inject(TranslationHelperService);

  private get token() {
    return localStorage.getItem('admin_token');
  }

  private handleError = (error: unknown) => {
    this.snackBar.open(this.i18n.t('Login failed. Please check your credentials.'), this.i18n.t('OK'), {
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
      this.hydrateUserInfoFromToken(this.token);
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
    this.hydrateUserInfoFromToken(token);
    this.loadUserInfo();
    this.router.navigate(['/dashboard']);
  }

  logout() {
    localStorage.removeItem('admin_token');
    this._isLoggedIn.set(false);
    this.username.set(null);
    this.role.set(null);
    this.router.navigate(['/login']);
  }

  hasToken(): boolean {
    return !!this.token;
  }

  loadUserInfo() {
    const token = localStorage.getItem('admin_token');
    if (!token) return;

    this.http.get<{ username: string; role: string; roles?: string[] }>(`${this.baseUrl}/me`, {
      headers: new HttpHeaders({
        Authorization: `Bearer ${token}`
      })
    }).subscribe({
      next: (data) => {
        this.username.set(data.username);
        this.role.set(data.role || data.roles?.[0] || null);
      },
      error: () => {
        this.username.set(null);
        this.role.set(null);
      }
    });
  }

  hasAnyRole(allowedRoles: readonly string[]): boolean {
    return allowedRoles.includes(this.role() ?? '');
  }

  private hydrateUserInfoFromToken(token: string) {
    try {
      const payloadPart = token.split('.')[1];
      if (!payloadPart) {
        return;
      }

      const normalized = payloadPart
        .replace(/-/g, '+')
        .replace(/_/g, '/')
        .padEnd(Math.ceil(payloadPart.length / 4) * 4, '=');
      const payload = JSON.parse(globalThis.atob(normalized)) as {
        username?: string;
        role?: string;
        roles?: string[];
      };

      if (typeof payload.username === 'string' && payload.username.trim()) {
        this.username.set(payload.username.trim());
      }

      const role = typeof payload.role === 'string'
        ? payload.role
        : Array.isArray(payload.roles) && typeof payload.roles[0] === 'string'
          ? payload.roles[0]
          : null;

      if (role) {
        this.role.set(role);
      }
    } catch {
      // ignore malformed token payload, loadUserInfo will refresh from backend
    }
  }
}
