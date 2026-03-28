import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
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
import {
  ADMIN_SESSION_CHANGED_EVENT,
  AdminTokenPayload,
  decodeAdminToken,
  getStoredAdminToken,
  getValidStoredAdminToken,
  isAdminSessionErrorResponse,
  removeStoredAdminToken,
  setStoredAdminToken
} from '../../utils/admin-token.util';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly sessionExpiredNotice = 'Your session has expired. Please sign in again.';
  private _isLoggedIn = signal(false);
  readonly isLoggedIn = this._isLoggedIn.asReadonly();

  readonly username = signal<string | null>(null);
  readonly role = signal<string | null>(null);

  private readonly baseUrl = `${environment.apiUrl}/user`;
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly snackBar = inject(DisplayMessageService);
  private readonly i18n = inject(TranslationHelperService);
  private sessionExpiryTimer: ReturnType<typeof setTimeout> | null = null;
  private sessionTerminationInProgress = false;

  private readonly syncSessionFromStorage = () => {
    const token = getStoredAdminToken();
    if (!token) {
      this.clearSessionState();
      return;
    }

    const payload = decodeAdminToken(token);
    if (!payload || this.isTokenExpired(payload)) {
      this.clearSessionState();
      removeStoredAdminToken();
      return;
    }

    this.applySessionState(token, payload);
  };

  private get token() {
    return getStoredAdminToken();
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
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', this.syncSessionFromStorage);
      window.addEventListener(ADMIN_SESSION_CHANGED_EVENT, this.syncSessionFromStorage);
    }

    this.syncSessionFromStorage();
    if (this._isLoggedIn()) {
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
    setStoredAdminToken(token);
    this.syncSessionFromStorage();
    this.loadUserInfo();
    this.router.navigate(['/dashboard']);
  }

  logout(notifyMessage?: string): void {
    this.terminateSession(notifyMessage ?? null);
  }

  hasToken(): boolean {
    return !!this.getValidToken();
  }

  hasValidSession(): boolean {
    return !!this.getValidToken();
  }

  getValidToken(): string | null {
    const token = getValidStoredAdminToken();
    if (token) {
      return token;
    }

    if (this.token) {
      this.clearSessionState();
      removeStoredAdminToken();
    }

    return null;
  }

  handleInvalidSession(): void {
    this.terminateSession(this.i18n.t(this.sessionExpiredNotice));
  }

  loadUserInfo() {
    const token = this.getValidToken();
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
      error: (error: unknown) => {
        if (error instanceof HttpErrorResponse && isAdminSessionErrorResponse(error.status, error.error)) {
          this.handleInvalidSession();
          return;
        }
        this.username.set(null);
        this.role.set(null);
      }
    });
  }

  hasAnyRole(allowedRoles: readonly string[]): boolean {
    return allowedRoles.includes(this.role() ?? '');
  }

  private applySessionState(token: string, payload: AdminTokenPayload): void {
    this._isLoggedIn.set(true);
    this.hydrateUserInfoFromToken(payload);
    this.scheduleSessionExpiry(token, payload);
  }

  private hydrateUserInfoFromToken(payload: AdminTokenPayload): void {
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
  }

  private scheduleSessionExpiry(token: string, payload: AdminTokenPayload): void {
    if (this.sessionExpiryTimer) {
      clearTimeout(this.sessionExpiryTimer);
      this.sessionExpiryTimer = null;
    }

    if (this.isTokenExpired(payload)) {
      this.handleInvalidSession();
      return;
    }

    if (typeof payload.exp !== 'number') {
      return;
    }

    const expiresInMs = payload.exp * 1000 - Date.now() - 5_000;
    this.sessionExpiryTimer = setTimeout(() => {
      if (getStoredAdminToken() === token) {
        this.handleInvalidSession();
      }
    }, Math.max(0, expiresInMs));
  }

  private isTokenExpired(payload: AdminTokenPayload): boolean {
    return typeof payload.exp !== 'number' || Date.now() >= payload.exp * 1000 - 5_000;
  }

  private clearSessionState(): void {
    if (this.sessionExpiryTimer) {
      clearTimeout(this.sessionExpiryTimer);
      this.sessionExpiryTimer = null;
    }

    this._isLoggedIn.set(false);
    this.username.set(null);
    this.role.set(null);
  }

  private terminateSession(notifyMessage: string | null): void {
    if (this.sessionTerminationInProgress) {
      return;
    }

    this.sessionTerminationInProgress = true;
    this.clearSessionState();
    removeStoredAdminToken();

    if (notifyMessage) {
      this.snackBar.open(notifyMessage, undefined, {
        duration: 4000,
        panelClass: ['snack-warning'],
        horizontalPosition: 'center',
        verticalPosition: 'top'
      });
    }

    void this.router.navigate(['/login']).finally(() => {
      this.sessionTerminationInProgress = false;
    });
  }
}
