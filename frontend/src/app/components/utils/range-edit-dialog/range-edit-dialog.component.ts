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

export interface RangeEditDialogData {
  title: string;
  minLabel: string;
  maxLabel: string;
  unit: string;
  minBound: number;
  maxBound: number;
  step: number;
  minValue: number;
  maxValue: number;
  helpTopic?: HelpTopic;
}

export interface RangeEditDialogResult {
  minValue: number;
  maxValue: number;
}

interface RangeEditForm {
  minValue: FormControl<number>;
  maxValue: FormControl<number>;
}

@Component({
  selector: 'app-range-edit-dialog',
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
  templateUrl: './range-edit-dialog.component.html',
  styleUrl: './range-edit-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RangeEditDialogComponent {
  readonly help = inject(HelpDialogService);
  private readonly dialogRef = inject(MatDialogRef<RangeEditDialogComponent>);
  readonly data = inject<RangeEditDialogData>(MAT_DIALOG_DATA);
  private readonly resolvedHelpTopic: HelpTopic = this.data.helpTopic ?? 'rangeEditDialog';

  readonly form = new FormGroup<RangeEditForm>({
    minValue: new FormControl(this.alignToStep(this.data.minValue), { nonNullable: true }),
    maxValue: new FormControl(this.alignToStep(this.data.maxValue), { nonNullable: true })
  });

  isRangeOrderInvalid(): boolean {
    return this.form.controls.minValue.value > this.form.controls.maxValue.value;
  }

  close(): void {
    this.dialogRef.close();
  }

  openHelp(): void {
    this.help.open(this.resolvedHelpTopic);
  }

  reset(): void {
    this.form.controls.minValue.setValue(this.data.minBound);
    this.form.controls.maxValue.setValue(this.data.maxBound);
  }

  apply(): void {
    const min = this.alignToStep(this.form.controls.minValue.value);
    const max = this.alignToStep(this.form.controls.maxValue.value);
    const normalized = {
      minValue: Math.min(min, max),
      maxValue: Math.max(min, max)
    } satisfies RangeEditDialogResult;
    this.dialogRef.close(normalized);
  }

  onMinBlur(): void {
    this.form.controls.minValue.setValue(this.alignToStep(this.form.controls.minValue.value));
  }

  onMaxBlur(): void {
    this.form.controls.maxValue.setValue(this.alignToStep(this.form.controls.maxValue.value));
  }

  decreaseMin(): void {
    this.stepControl('minValue', -1);
  }

  increaseMin(): void {
    this.stepControl('minValue', 1);
  }

  decreaseMax(): void {
    this.stepControl('maxValue', -1);
  }

  increaseMax(): void {
    this.stepControl('maxValue', 1);
  }

  getMinFieldLabel(): string {
    return `${this.data.minLabel} (${this.formatBound(this.data.minBound)})`;
  }

  getMaxFieldLabel(): string {
    return `${this.data.maxLabel} (${this.formatBound(this.data.maxBound)})`;
  }

  getHeaderSubtitle(): string {
    if (!this.isRangeOrderInvalid()) {
      return '';
    }
    return `${this.data.minLabel} ≤ ${this.data.maxLabel}`;
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

  private stepControl(control: 'minValue' | 'maxValue', direction: -1 | 1): void {
    const stepSize = Number.isFinite(this.data.step) && this.data.step > 0 ? this.data.step : 1;
    const current = this.form.controls[control].value;
    const next = this.alignToStep(current + stepSize * direction);
    this.form.controls[control].setValue(next);
  }

  private formatBound(value: number): string {
    return this.data.unit ? `${value} ${this.data.unit}` : `${value}`;
  }
}
