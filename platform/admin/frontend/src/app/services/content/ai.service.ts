import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { catchError, finalize, map, Observable, of, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AiModel } from '../../interfaces/ai-model.interface';
import { AiSettings } from '../../interfaces/ai-settings.interface';
import { AiToolRequest } from '../../interfaces/ai-tool-request.interface';
import { AiToolResult } from '../../interfaces/ai-tool-result.interface';
import { AiUsage } from '../../interfaces/ai-usage.interface';
import { TranslationHelperService } from '../translation-helper.service';
import { DisplayMessageService } from '../display-message.service';

interface AiSettingsResponse {
  status: number;
  row: AiSettings;
}

interface AiModelsResponse {
  status: number;
  configured: boolean;
  selectedModel: string;
  defaultModel: string;
  rows: AiModel[];
}

interface AiApplyResponse {
  status: number;
  result: AiToolResult;
}

interface AiUsageResponse {
  status: number;
  row: AiUsage;
}

@Injectable({
  providedIn: 'root'
})
export class AiService {
  private readonly http = inject(HttpClient);
  private readonly snackBar = inject(DisplayMessageService);
  private readonly i18n = inject(TranslationHelperService);
  private readonly baseUrl = `${environment.apiUrl}/ai`;

  private readonly _settings = signal<AiSettings | null>(null);
  readonly settings = this._settings.asReadonly();

  private readonly _models = signal<AiModel[]>([]);
  readonly models = this._models.asReadonly();

  private readonly _usage = signal<AiUsage | null>(null);
  readonly usage = this._usage.asReadonly();

  private readonly _settingsLoading = signal(false);
  readonly settingsLoading = this._settingsLoading.asReadonly();

  private readonly _modelsLoading = signal(false);
  readonly modelsLoading = this._modelsLoading.asReadonly();

  private readonly _usageLoading = signal(false);
  readonly usageLoading = this._usageLoading.asReadonly();

  loadSettings(): void {
    this._settingsLoading.set(true);
    this.http.get<AiSettingsResponse>(`${this.baseUrl}/settings`).pipe(
      catchError((error) => {
        this.handleError(error, 'Could not load AI settings.');
        return of({ status: 0, row: null as AiSettings | null });
      }),
      finalize(() => this._settingsLoading.set(false))
    ).subscribe((response) => {
      this._settings.set(response.row ?? null);
    });
  }

  updateSettings(selectedModel: string, monthlyBudgetUsd: number): Observable<AiSettings> {
    return this.http.put<AiSettingsResponse>(`${this.baseUrl}/settings`, { selectedModel, monthlyBudgetUsd }).pipe(
      map((response) => response.row),
      map((row) => {
        this._settings.set(row);
        this._usage.update((current) => current ? {
          ...current,
          monthlyBudgetUsd: row.monthlyBudgetUsd,
          budgetConfigured: row.monthlyBudgetUsd > 0,
          remainingBudgetUsd: row.monthlyBudgetUsd > 0
            ? Math.round((row.monthlyBudgetUsd - current.currentMonth.spend.value) * 100) / 100
            : null
        } : current);
        this._models.update((current) => current.map((entry) => ({
          ...entry,
          isSelected: entry.id === row.selectedModel
        })));
        return row;
      }),
      catchError((error) => this.handleError(error, 'Could not save AI settings.'))
    );
  }

  loadModels(forceRefresh = false): void {
    this._modelsLoading.set(true);
    const params = forceRefresh ? new HttpParams().set('force', 'true') : undefined;
    this.http.get<AiModelsResponse>(`${this.baseUrl}/models`, { params }).pipe(
      catchError((error) => {
        this.handleError(error, 'Could not load available AI models.');
        return of({
          status: 0,
          configured: false,
          selectedModel: '',
          defaultModel: '',
          rows: []
        });
      }),
      finalize(() => this._modelsLoading.set(false))
    ).subscribe((response) => {
      this._models.set(Array.isArray(response.rows) ? response.rows : []);

      const current = this._settings();
      if (!current) {
        this._settings.set({
          selectedModel: response.selectedModel || response.defaultModel || '',
          defaultModel: response.defaultModel || response.selectedModel || '',
          monthlyBudgetUsd: 0,
          updatedAt: 0,
          apiConfigured: response.configured === true
        });
        return;
      }

      this._settings.set({
        ...current,
        selectedModel: current.selectedModel || response.selectedModel || response.defaultModel || '',
        defaultModel: response.defaultModel || current.defaultModel,
        apiConfigured: response.configured === true
      });
    });
  }

  loadUsage(): void {
    this._usageLoading.set(true);
    this.http.get<AiUsageResponse>(`${this.baseUrl}/usage`).pipe(
      catchError((error) => {
        this.handleError(error, 'Could not load AI usage data.');
        return of({ status: 0, row: null as AiUsage | null });
      }),
      finalize(() => this._usageLoading.set(false))
    ).subscribe((response) => {
      this._usage.set(response.row ?? null);
    });
  }

  applyTool(payload: AiToolRequest): Observable<AiToolResult> {
    return this.http.post<AiApplyResponse>(`${this.baseUrl}/apply`, payload).pipe(
      map((response) => response.result),
      catchError((error) => this.handleError(error, 'Could not run AI tool.'))
    );
  }

  private handleError(error: unknown, fallbackMessage: string) {
    this.snackBar.open(this.resolveErrorMessage(error, fallbackMessage), this.i18n.t('OK'), {
      duration: 3400,
      panelClass: ['snack-error'],
      horizontalPosition: 'center',
      verticalPosition: 'top'
    });
    return throwError(() => error);
  }

  private resolveErrorMessage(error: unknown, fallbackMessage: string): string {
    if (error instanceof HttpErrorResponse) {
      const message = error.error?.message || error.error?.error || error.message;
      if (typeof message === 'string' && message.trim()) {
        return this.i18n.t(message.trim());
      }
    }
    return this.i18n.t(fallbackMessage);
  }
}
