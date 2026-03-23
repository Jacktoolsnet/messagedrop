import { CommonModule, CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { finalize, startWith } from 'rxjs';
import { AiModel } from '../../../interfaces/ai-model.interface';
import { AiService } from '../../../services/content/ai.service';

@Component({
  selector: 'app-ai-settings',
  imports: [
    CommonModule,
    CurrencyPipe,
    DatePipe,
    DecimalPipe,
    ReactiveFormsModule,
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressBarModule,
    MatChipsModule
  ],
  templateUrl: './ai-settings.component.html',
  styleUrl: './ai-settings.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AiSettingsComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly snackBar = inject(MatSnackBar);
  private readonly aiService = inject(AiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly settings = this.aiService.settings;
  readonly models = this.aiService.models;
  readonly usage = this.aiService.usage;
  readonly returnTo = computed(() => {
    const raw = this.route.snapshot.queryParamMap.get('returnTo')?.trim() || '';
    return raw.startsWith('/dashboard/content') ? raw : '/dashboard/content';
  });
  readonly loading = computed(() => this.aiService.settingsLoading() || this.aiService.modelsLoading() || this.aiService.usageLoading());
  readonly savePending = signal(false);
  readonly saving = computed(() => this.savePending());
  readonly form = this.fb.nonNullable.group({
    selectedModel: this.fb.nonNullable.control(''),
    monthlyBudgetUsd: this.fb.nonNullable.control(0)
  });
  readonly formValue = toSignal(
    this.form.valueChanges.pipe(startWith(this.form.getRawValue())),
    { initialValue: this.form.getRawValue() }
  );
  readonly selectedModelMeta = computed(() => {
    const selectedModel = (this.formValue().selectedModel ?? '').trim();
    if (!selectedModel) {
      return null;
    }
    return this.models().find((row) => row.id === selectedModel) ?? null;
  });
  readonly canSave = computed(() => {
    const selectedModel = (this.formValue().selectedModel ?? '').trim();
    const monthlyBudgetUsd = this.normalizeBudgetValue(this.formValue().monthlyBudgetUsd);
    const settings = this.settings();
    return !!selectedModel
      && !this.saving()
      && (
        selectedModel !== (settings?.selectedModel ?? '')
        || monthlyBudgetUsd !== this.normalizeBudgetValue(settings?.monthlyBudgetUsd ?? 0)
      );
  });
  readonly configured = computed(() => this.settings()?.apiConfigured === true);
  readonly budgetExceeded = computed(() => {
    const remaining = this.usage()?.remainingBudgetUsd;
    return this.usage()?.budgetConfigured === true && typeof remaining === 'number' && remaining < 0;
  });
  private readonly lastSyncedModel = signal('');
  private readonly lastSyncedBudget = signal(0);

  constructor() {
    this.aiService.loadSettings();
    this.aiService.loadModels();
    this.aiService.loadUsage();

    effect(() => {
      const settings = this.settings();
      const nextValue = settings?.selectedModel?.trim() || settings?.defaultModel?.trim() || '';
      const nextBudget = this.normalizeBudgetValue(settings?.monthlyBudgetUsd ?? 0);
      const currentValue = this.form.controls.selectedModel.value.trim();
      const currentBudget = this.normalizeBudgetValue(this.form.controls.monthlyBudgetUsd.value);
      const lastSyncedModel = this.lastSyncedModel();
      const lastSyncedBudget = this.lastSyncedBudget();

      if (!nextValue) {
        return;
      }

      const canSyncModel = !currentValue || currentValue === lastSyncedModel || currentValue === nextValue;
      const canSyncBudget = currentBudget === lastSyncedBudget || currentBudget === nextBudget;

      if (canSyncModel && canSyncBudget) {
        this.form.setValue({
          selectedModel: nextValue,
          monthlyBudgetUsd: nextBudget
        }, { emitEvent: false });
        this.lastSyncedModel.set(nextValue);
        this.lastSyncedBudget.set(nextBudget);
      }
    }, { allowSignalWrites: true });
  }

  refreshModels(): void {
    this.aiService.loadModels(true);
  }

  goBack(): void {
    this.router.navigateByUrl(this.returnTo());
  }

  save(): void {
    const selectedModel = this.form.controls.selectedModel.value.trim();
    const monthlyBudgetUsd = this.normalizeBudgetValue(this.form.controls.monthlyBudgetUsd.value);
    if (!selectedModel || this.saving()) {
      return;
    }

    this.savePending.set(true);
    this.aiService.updateSettings(selectedModel, monthlyBudgetUsd)
      .pipe(
        finalize(() => {
          this.savePending.set(false);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (row) => {
          this.form.setValue({
            selectedModel: row.selectedModel,
            monthlyBudgetUsd: this.normalizeBudgetValue(row.monthlyBudgetUsd)
          }, { emitEvent: false });
          this.lastSyncedModel.set(row.selectedModel);
          this.lastSyncedBudget.set(this.normalizeBudgetValue(row.monthlyBudgetUsd));
          this.aiService.loadUsage();
          this.snackBar.open('AI settings saved.', 'OK', {
            duration: 2400,
            horizontalPosition: 'center',
            verticalPosition: 'top'
          });
        }
      });
  }

  modelTrackBy(_index: number, row: AiModel): string {
    return row.id;
  }

  private normalizeBudgetValue(value: unknown): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return 0;
    }
    return Math.max(0, Math.min(1_000_000, Math.round(parsed * 100) / 100));
  }
}
