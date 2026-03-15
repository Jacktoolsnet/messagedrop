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
  errorMessage?: string;
  stack?: string;
  source?: string;
  line?: number;
  column?: number;
  errorCode?: string;
  appVersion?: string;
  environment?: 'dev' | 'prod';
  createdAt: number;
}

interface ResourceErrorContext {
  feature: string;
  source?: string;
  errorCode: string;
  errorMessage: string;
  ignore: boolean;
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
    const details = this.extractErrorDetails(error);
    const payload: FrontendErrorPayload = {
      client: 'web',
      event: 'http_error',
      severity: 'error',
      path: this.stripUrl(req.url),
      status: typeof status === 'number' ? status : undefined,
      errorName: details.errorName ?? this.safeToken(httpError?.name),
      errorMessage: details.errorMessage,
      stack: details.stack,
      source: details.source,
      line: details.line,
      column: details.column,
      appVersion: APP_VERSION_INFO.version,
      environment: environment.production ? 'prod' : 'dev',
      createdAt: Date.now()
    };
    this.send(payload);
  }

  logRuntimeError(error: unknown, overrides?: Partial<FrontendErrorPayload>): void {
    const details = this.extractErrorDetails(error);
    const payload: FrontendErrorPayload = {
      client: 'web',
      event: 'runtime_error',
      severity: 'error',
      path: this.getCurrentPath(),
      errorName: details.errorName,
      errorMessage: details.errorMessage,
      stack: details.stack,
      source: details.source,
      line: details.line,
      column: details.column,
      appVersion: APP_VERSION_INFO.version,
      environment: environment.production ? 'prod' : 'dev',
      createdAt: Date.now(),
      ...overrides
    };
    this.send(payload);
  }

  logUnhandledRejection(reason: unknown): void {
    const details = this.extractErrorDetails(reason);
    const payload: FrontendErrorPayload = {
      client: 'web',
      event: 'unhandled_rejection',
      severity: 'error',
      path: this.getCurrentPath(),
      errorName: details.errorName,
      errorMessage: details.errorMessage,
      stack: details.stack,
      source: details.source,
      line: details.line,
      column: details.column,
      appVersion: APP_VERSION_INFO.version,
      environment: environment.production ? 'prod' : 'dev',
      createdAt: Date.now()
    };
    this.send(payload);
  }

  logHealthCheckError(feature: string, error: unknown, overrides?: Partial<FrontendErrorPayload>): void {
    const httpError = error instanceof HttpErrorResponse ? error : undefined;
    const details = this.extractErrorDetails(error);
    const payload: FrontendErrorPayload = {
      client: 'web',
      event: 'runtime_error',
      severity: 'error',
      feature: this.safeToken(feature),
      path: this.getCurrentPath(),
      status: typeof httpError?.status === 'number' ? httpError.status : undefined,
      errorName: details.errorName ?? this.safeToken(httpError?.name),
      errorMessage: details.errorMessage ?? this.safeMessage(httpError?.message),
      stack: details.stack,
      source: details.source,
      line: details.line,
      column: details.column,
      appVersion: APP_VERSION_INFO.version,
      environment: environment.production ? 'prod' : 'dev',
      createdAt: Date.now(),
      ...overrides
    };
    this.send(payload, true);
  }

  private handleWindowError(event: Event): void {
    if (event instanceof ErrorEvent) {
      this.logRuntimeError(event.error ?? event.message, {
        errorMessage: event.message,
        source: event.filename,
        line: Number.isFinite(event.lineno) ? event.lineno : undefined,
        column: Number.isFinite(event.colno) ? event.colno : undefined
      });
      return;
    }
    const resourceContext = this.extractResourceErrorContext(event.target);
    if (!resourceContext || resourceContext.ignore) {
      return;
    }
    const payload: FrontendErrorPayload = {
      client: 'web',
      event: 'resource_error',
      severity: 'warning',
      feature: this.safeToken(resourceContext.feature),
      path: this.getCurrentPath(),
      errorCode: this.safeToken(resourceContext.errorCode),
      errorMessage: this.safeMessage(resourceContext.errorMessage),
      source: resourceContext.source,
      appVersion: APP_VERSION_INFO.version,
      environment: environment.production ? 'prod' : 'dev',
      createdAt: Date.now()
    };
    this.send(payload);
  }

  private send(payload: FrontendErrorPayload, force = false): void {
    if (!force && !this.canSend()) {
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
    return path.split('?')[0].split('#')[0].slice(0, 200);
  }

  private safeToken(value?: string, maxLen = 80): string | undefined {
    if (!value) return undefined;
    return value.replace(/[^a-zA-Z0-9_.+-]/g, '').slice(0, maxLen) || undefined;
  }

  private safeMessage(value?: string, maxLen = 300): string | undefined {
    if (!value) return undefined;
    return value.replace(/[^\x20-\x7E]/g, '').slice(0, maxLen) || undefined;
  }

  private safeStack(value?: string, maxLen = 4000): string | undefined {
    if (!value) return undefined;
    return value.replace(/[^\t\n\r\x20-\x7E]/g, '').slice(0, maxLen) || undefined;
  }

  private safeSource(value?: string): string | undefined {
    if (!value) return undefined;
    try {
      if (/^https?:\/\//i.test(value)) {
        const parsed = new URL(value);
        return this.safePath(`${parsed.hostname}${parsed.pathname}`);
      }
    } catch {
      return undefined;
    }
    return this.safePath(value);
  }

  private extractResourceErrorContext(target: EventTarget | null): ResourceErrorContext | null {
    if (!(target instanceof Element)) {
      return null;
    }
    const tagName = target.tagName?.toLowerCase();
    if (!tagName) {
      return null;
    }

    const source = this.getResourceSource(target);
    const className = this.getResourceClassName(target);
    const online = typeof navigator !== 'undefined' ? navigator.onLine : undefined;
    const ignore = tagName === 'img' && this.isIgnorableTileError(source, className);
    const classification = this.classifyResourceError(tagName, source);
    const details = [classification.errorCode, `tag=${tagName}`];

    if (source) {
      details.push(`src=${source}`);
    }
    if (className) {
      details.push(`class=${className}`);
    }
    if (typeof online === 'boolean') {
      details.push(`online=${online ? 'true' : 'false'}`);
    }

    return {
      feature: classification.feature,
      source,
      errorCode: classification.errorCode,
      errorMessage: details.join(' '),
      ignore
    };
  }

  private getResourceSource(target: Element): string | undefined {
    if (target instanceof HTMLImageElement) {
      return this.normalizeResourceSource(target.currentSrc || target.src);
    }
    if (target instanceof HTMLScriptElement) {
      return this.normalizeResourceSource(target.src);
    }
    if (target instanceof HTMLLinkElement) {
      return this.normalizeResourceSource(target.href);
    }
    const candidate = target.getAttribute('src') ?? target.getAttribute('href') ?? undefined;
    return this.normalizeResourceSource(candidate);
  }

  private normalizeResourceSource(value?: string): string | undefined {
    if (!value) return undefined;
    try {
      const parsed = new URL(value, typeof window !== 'undefined' ? window.location.origin : undefined);
      const normalized = `${parsed.origin}${parsed.pathname}`;
      return normalized.slice(0, 240);
    } catch {
      return value.split('?')[0].split('#')[0].slice(0, 240) || undefined;
    }
  }

  private classifyResourceError(tagName: string, source?: string): { feature: string; errorCode: string } {
    const normalizedSource = String(source ?? '').toLowerCase();
    if (this.isMarkerAssetSource(normalizedSource)) {
      return {
        feature: `marker_asset_${tagName}`,
        errorCode: 'marker_asset_load_failed'
      };
    }
    if (this.isLocalAssetSource(normalizedSource)) {
      return {
        feature: `local_asset_${tagName}`,
        errorCode: 'local_asset_load_failed'
      };
    }
    return {
      feature: tagName,
      errorCode: `${tagName}_load_failed`
    };
  }

  private getResourceClassName(target: Element): string | undefined {
    const rawClassName = target.getAttribute('class') ?? '';
    if (!rawClassName.trim()) {
      return undefined;
    }
    const normalized = rawClassName
      .trim()
      .split(/\s+/)
      .map((token) => this.safeToken(token, 40))
      .filter((token): token is string => !!token)
      .slice(0, 5)
      .join('.');
    return normalized || undefined;
  }

  private isIgnorableTileError(source?: string, className?: string): boolean {
    const normalizedSource = String(source ?? '').toLowerCase();
    const normalizedClassName = String(className ?? '').toLowerCase();
    return normalizedClassName.includes('leaflet-tile')
      || normalizedSource.includes('tile.openstreetmap.org/');
  }

  private isLocalAssetSource(source: string): boolean {
    if (!source) {
      return false;
    }
    return source.startsWith('/assets/')
      || source.startsWith('assets/')
      || source.includes('/assets/');
  }

  private isMarkerAssetSource(source: string): boolean {
    if (!source) {
      return false;
    }
    return source.startsWith('/assets/markers/')
      || source.startsWith('assets/markers/')
      || source.includes('/assets/markers/');
  }

  private extractErrorDetails(error: unknown): {
    errorName?: string;
    errorMessage?: string;
    stack?: string;
    source?: string;
    line?: number;
    column?: number;
  } {
    if (error instanceof Error) {
      const location = this.parseStackLocation(error.stack);
      return {
        errorName: error.name,
        errorMessage: error.message,
        stack: error.stack,
        ...location
      };
    }
    if (typeof error === 'string') {
      return { errorMessage: error };
    }
    if (error && typeof error === 'object') {
      const maybe = error as { name?: unknown; message?: unknown; stack?: unknown; fileName?: unknown; lineNumber?: unknown; columnNumber?: unknown };
      const message = typeof maybe.message === 'string' ? maybe.message : undefined;
      const stack = typeof maybe.stack === 'string' ? maybe.stack : undefined;
      const location = this.parseStackLocation(stack);
      return {
        errorName: typeof maybe.name === 'string' ? maybe.name : undefined,
        errorMessage: message,
        stack,
        source: typeof maybe.fileName === 'string' ? maybe.fileName : location.source,
        line: typeof maybe.lineNumber === 'number' ? maybe.lineNumber : location.line,
        column: typeof maybe.columnNumber === 'number' ? maybe.columnNumber : location.column
      };
    }
    return {};
  }

  private parseStackLocation(stack?: string): { source?: string; line?: number; column?: number } {
    if (!stack) return {};
    const match = stack.match(/(?:at\s+.*\()?(https?:\/\/[^\s)]+|\/[^\s)]+|[A-Za-z]:\\[^\s)]+):(\d+):(\d+)/);
    if (!match) return {};
    const line = Number(match[2]);
    const column = Number(match[3]);
    return {
      source: match[1],
      line: Number.isFinite(line) ? line : undefined,
      column: Number.isFinite(column) ? column : undefined
    };
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
      errorMessage: this.safeMessage(payload.errorMessage),
      stack: this.safeStack(payload.stack),
      source: this.safeSource(payload.source),
      line: typeof payload.line === 'number' && Number.isFinite(payload.line)
        ? Math.max(0, Math.floor(payload.line))
        : undefined,
      column: typeof payload.column === 'number' && Number.isFinite(payload.column)
        ? Math.max(0, Math.floor(payload.column))
        : undefined,
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
      payload.feature ?? '',
      payload.path ?? '',
      payload.status ?? '',
      payload.errorName ?? '',
      payload.errorCode ?? '',
      payload.source ?? ''
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
