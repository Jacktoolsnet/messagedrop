import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
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
    DatePipe,
    ReactiveFormsModule,
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
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
  readonly returnTo = computed(() => {
    const raw = this.route.snapshot.queryParamMap.get('returnTo')?.trim() || '';
    return raw.startsWith('/dashboard/content') ? raw : '/dashboard/content';
  });
  readonly loading = computed(() => this.aiService.settingsLoading() || this.aiService.modelsLoading());
  readonly savePending = signal(false);
  readonly saving = computed(() => this.savePending());
  readonly form = this.fb.nonNullable.group({
    selectedModel: this.fb.nonNullable.control('')
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
    const settings = this.settings();
    return !!selectedModel && !this.saving() && selectedModel !== (settings?.selectedModel ?? '');
  });
  readonly configured = computed(() => this.settings()?.apiConfigured === true);
  private readonly lastSyncedModel = signal('');

  constructor() {
    this.aiService.loadSettings();
    this.aiService.loadModels();

    effect(() => {
      const settings = this.settings();
      const nextValue = settings?.selectedModel?.trim() || settings?.defaultModel?.trim() || '';
      const currentValue = this.form.controls.selectedModel.value.trim();
      const lastSyncedModel = this.lastSyncedModel();

      if (!nextValue) {
        return;
      }

      if (!currentValue || currentValue === lastSyncedModel || currentValue === nextValue) {
        this.form.controls.selectedModel.setValue(nextValue, { emitEvent: false });
        this.lastSyncedModel.set(nextValue);
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
    if (!selectedModel || this.saving()) {
      return;
    }

    this.savePending.set(true);
    this.aiService.updateSettings(selectedModel)
      .pipe(
        finalize(() => {
          this.savePending.set(false);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (row) => {
          this.form.controls.selectedModel.setValue(row.selectedModel, { emitEvent: false });
          this.lastSyncedModel.set(row.selectedModel);
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
}
