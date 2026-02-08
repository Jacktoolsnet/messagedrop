import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import { DialogHeaderComponent } from '../dialog-header/dialog-header.component';
import { HelpDialogService, HelpTopic } from '../help-dialog/help-dialog.service';

export interface ValueEditDialogData {
  title: string;
  label: string;
  unit?: string;
  minBound: number;
  maxBound: number;
  step: number;
  value: number;
  helpTopic?: HelpTopic;
}

export interface ValueEditDialogResult {
  value: number;
}

interface ValueEditForm {
  value: FormControl<number>;
}

@Component({
  selector: 'app-value-edit-dialog',
  standalone: true,
  imports: [
    DialogHeaderComponent,
    ReactiveFormsModule,
    MatDialogContent,
    MatDialogActions,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIcon,
    TranslocoPipe
  ],
  templateUrl: './value-edit-dialog.component.html',
  styleUrl: './value-edit-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ValueEditDialogComponent {
  readonly help = inject(HelpDialogService);
  private readonly dialogRef = inject(MatDialogRef<ValueEditDialogComponent>);
  readonly data = inject<ValueEditDialogData>(MAT_DIALOG_DATA);
  private readonly resolvedHelpTopic: HelpTopic = this.data.helpTopic ?? 'valueEditDialog';

  readonly form = new FormGroup<ValueEditForm>({
    value: new FormControl(this.alignToStep(this.data.value), { nonNullable: true })
  });

  close(): void {
    this.dialogRef.close();
  }

  openHelp(): void {
    this.help.open(this.resolvedHelpTopic);
  }

  reset(): void {
    this.form.controls.value.setValue(this.alignToStep(this.data.value));
  }

  apply(): void {
    this.dialogRef.close({
      value: this.alignToStep(this.form.controls.value.value)
    } satisfies ValueEditDialogResult);
  }

  onBlur(): void {
    this.form.controls.value.setValue(this.alignToStep(this.form.controls.value.value));
  }

  decrease(): void {
    this.stepControl(-1);
  }

  increase(): void {
    this.stepControl(1);
  }

  getFieldLabel(): string {
    return `${this.data.label} (${this.formatBound(this.data.minBound)} - ${this.formatBound(this.data.maxBound)})`;
  }

  private alignToStep(value: number): number {
    const minBound = this.data.minBound;
    const maxBound = this.data.maxBound;
    const safeStep = Number.isFinite(this.data.step) && this.data.step > 0 ? this.data.step : 1;
    const numeric = Number.isFinite(value) ? value : minBound;
    const clamped = Math.max(minBound, Math.min(maxBound, numeric));
    const rounded = minBound + Math.round((clamped - minBound) / safeStep) * safeStep;
    const bounded = Math.max(minBound, Math.min(maxBound, rounded));
    return Number.isFinite(bounded) ? bounded : minBound;
  }

  private stepControl(direction: -1 | 1): void {
    const stepSize = Number.isFinite(this.data.step) && this.data.step > 0 ? this.data.step : 1;
    const current = this.form.controls.value.value;
    const next = this.alignToStep(current + stepSize * direction);
    this.form.controls.value.setValue(next);
  }

  private formatBound(value: number): string {
    return this.data.unit ? `${value} ${this.data.unit}` : `${value}`;
  }
}
