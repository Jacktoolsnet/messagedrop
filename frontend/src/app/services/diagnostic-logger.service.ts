import { HttpBackend, HttpClient, HttpErrorResponse, HttpRequest } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { APP_VERSION_INFO } from '../../environments/version';
import { environment } from '../../environments/environment';
import { AppService } from './app.service';

type FrontendErrorEvent = 'http_error' | 'runtime_error' | 'unhandled_rejection' | 'resource_error';
type FrontendSeverity = 'warning' | 'error';

interface FrontendErrorPayload {
  client: 'web';
  event: FrontendErrorEvent;
  severity: FrontendSeverity;
  feature?: string;
  path?: string;
  status?: number;
  errorName?: string;
  errorCode?: string;
  appVersion?: string;
  environment?: 'dev' | 'prod';
  createdAt: number;
}

@Injectable({ providedIn: 'root' })
export class DiagnosticLoggerService {
  private readonly appService = inject(AppService);
  private readonly httpBackend = inject(HttpBackend);
  private readonly rawHttp = new HttpClient(this.httpBackend);
  private readonly throttleMs = 30000;
  private readonly lastSent = new Map<string, number>();

  initGlobalHandlers(): void {
    if (typeof window === 'undefined') {
      return;
    }
    window.addEventListener('error', (event) => this.handleWindowError(event), true);
    window.addEventListener('unhandledrejection', (event) => this.logUnhandledRejection(event?.reason));
  }

  logHttpError(req: HttpRequest<unknown>, error: unknown): void {
    const httpError = error instanceof HttpErrorResponse ? error : undefined;
    const status = httpError?.status;
    const payload: FrontendErrorPayload = {
      client: 'web',
      event: 'http_error',
      severity: 'error',
      path: this.stripUrl(req.url),
      status: typeof status === 'number' ? status : undefined,
      errorName: this.safeToken(httpError?.name),
      appVersion: APP_VERSION_INFO.version,
      environment: environment.production ? 'prod' : 'dev',
      createdAt: Date.now()
    };
    this.send(payload);
  }

  logRuntimeError(error: unknown): void {
    const err = error instanceof Error ? error : undefined;
    const payload: FrontendErrorPayload = {
      client: 'web',
      event: 'runtime_error',
      severity: 'error',
      path: this.getCurrentPath(),
      errorName: this.safeToken(err?.name),
      appVersion: APP_VERSION_INFO.version,
      environment: environment.production ? 'prod' : 'dev',
      createdAt: Date.now()
    };
    this.send(payload);
  }

  logUnhandledRejection(reason: unknown): void {
    const err = reason instanceof Error ? reason : undefined;
    const payload: FrontendErrorPayload = {
      client: 'web',
      event: 'unhandled_rejection',
      severity: 'error',
      path: this.getCurrentPath(),
      errorName: this.safeToken(err?.name),
      appVersion: APP_VERSION_INFO.version,
      environment: environment.production ? 'prod' : 'dev',
      createdAt: Date.now()
    };
    this.send(payload);
  }

  private handleWindowError(event: Event): void {
    if (event instanceof ErrorEvent) {
      this.logRuntimeError(event.error ?? event.message);
      return;
    }
    const target = event.target as HTMLElement | null;
    if (!target || !('tagName' in target)) {
      return;
    }
    const tagName = target.tagName?.toLowerCase();
    if (!tagName) {
      return;
    }
    const payload: FrontendErrorPayload = {
      client: 'web',
      event: 'resource_error',
      severity: 'warning',
      feature: this.safeToken(tagName),
      path: this.getCurrentPath(),
      appVersion: APP_VERSION_INFO.version,
      environment: environment.production ? 'prod' : 'dev',
      createdAt: Date.now()
    };
    this.send(payload);
  }

  private send(payload: FrontendErrorPayload): void {
    if (!this.canSend()) {
      return;
    }
    const sanitized = this.sanitizePayload(payload);
    if (!sanitized || this.isThrottled(sanitized)) {
      return;
    }
    void firstValueFrom(
      this.rawHttp.post(`${environment.apiUrl}/frontend-error-log`, sanitized, {
        headers: { 'Content-Type': 'application/json' }
      })
    ).catch(() => undefined);
  }

  private canSend(): boolean {
    if (!this.appService.isSettingsReady()) {
      return false;
    }
    return this.appService.getAppSettings().diagnosticLogging === true;
  }

  private getCurrentPath(): string | undefined {
    if (typeof window === 'undefined') {
      return undefined;
    }
    return this.safePath(window.location?.pathname);
  }

  private stripUrl(url: string): string | undefined {
    try {
      const parsed = new URL(url, typeof window !== 'undefined' ? window.location.origin : undefined);
      return this.safePath(parsed.pathname);
    } catch {
      return this.safePath(url);
    }
  }

  private safePath(path?: string): string | undefined {
    if (!path) return undefined;
    return path.split('?')[0].slice(0, 200);
  }

  private safeToken(value?: string): string | undefined {
    if (!value) return undefined;
    return value.replace(/[^a-zA-Z0-9_.+-]/g, '').slice(0, 80) || undefined;
  }

  private sanitizePayload(payload: FrontendErrorPayload): FrontendErrorPayload | null {
    const allowedEvents: FrontendErrorEvent[] = ['http_error', 'runtime_error', 'unhandled_rejection', 'resource_error'];
    const allowedSeverities: FrontendSeverity[] = ['warning', 'error'];
    if (!allowedEvents.includes(payload.event) || !allowedSeverities.includes(payload.severity)) {
      return null;
    }
    return {
      client: 'web',
      event: payload.event,
      severity: payload.severity,
      feature: this.safeToken(payload.feature),
      path: this.safePath(payload.path),
      status: typeof payload.status === 'number' ? payload.status : undefined,
      errorName: this.safeToken(payload.errorName),
      errorCode: this.safeToken(payload.errorCode),
      appVersion: this.safeToken(payload.appVersion),
      environment: payload.environment === 'prod' ? 'prod' : 'dev',
      createdAt: Number.isFinite(payload.createdAt) ? payload.createdAt : Date.now()
    };
  }

  private isThrottled(payload: FrontendErrorPayload): boolean {
    const key = [
      payload.event,
      payload.severity,
      payload.path ?? '',
      payload.status ?? '',
      payload.errorName ?? ''
    ].join('|');
    const now = Date.now();
    const last = this.lastSent.get(key);
    if (last && now - last < this.throttleMs) {
      return true;
    }
    this.lastSent.set(key, now);
    return false;
  }
}
