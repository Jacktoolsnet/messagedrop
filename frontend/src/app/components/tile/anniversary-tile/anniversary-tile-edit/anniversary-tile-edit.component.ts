
import { A11yModule } from '@angular/cdk/a11y';
import { ChangeDetectionStrategy, Component, ViewChild, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatNativeDateModule, provideNativeDateAdapter } from '@angular/material/core';
import { MatCalendar, MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogContent, MatDialogModule, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import { TileSetting } from '../../../../interfaces/tile-settings';
import { TranslationHelperService } from '../../../../services/translation-helper.service';
import { HelpDialogService } from '../../../utils/help-dialog/help-dialog.service';
import { MaticonPickerComponent } from '../../../utils/maticon-picker/maticon-picker.component';

interface AnniversaryTileDialogData {
  tile: TileSetting;
}

@Component({
  selector: 'app-anniversary-tile-edit',
  standalone: true,
  providers: [provideNativeDateAdapter()],
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatFormFieldModule,
    MatInputModule,
    MatNativeDateModule,
    MatButtonModule,
    MatIcon,
    MatCardModule,
    MatDatepickerModule,
    A11yModule,
    TranslocoPipe
  ],
  templateUrl: './anniversary-tile-edit.component.html',
  styleUrl: './anniversary-tile-edit.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AnniversaryTileEditComponent {
  @ViewChild(MatCalendar) calendar?: MatCalendar<Date>;
  private readonly dialogRef = inject(MatDialogRef<AnniversaryTileEditComponent>);
  private readonly dialog = inject(MatDialog);
  private readonly translation = inject(TranslationHelperService);
  readonly help = inject(HelpDialogService);
  readonly data = inject<AnniversaryTileDialogData>(MAT_DIALOG_DATA);

  readonly titleControl = new FormControl(
    this.data.tile.payload?.title ?? this.data.tile.label ?? this.translation.t('common.tileTypes.anniversary'),
    { nonNullable: true }
  );
  readonly dateControl = new FormControl<Date | null>(this.toDate(this.data.tile.payload?.date), { validators: [Validators.required] });
  readonly icon = signal<string | undefined>(this.data.tile.payload?.icon ?? 'event');

  private toDate(value: string | undefined): Date | null {
    if (!value) return null;
    const [y, m, d] = value.split('-').map(Number);
    if (!y || !m || !d) return null;
    const date = new Date(y, m - 1, d);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  get startAt(): Date {
    return this.dateControl.value ?? new Date();
  }

  onDateSelected(date: Date | null): void {
    this.dateControl.setValue(date);
    this.dateControl.markAsTouched();
  }

  pickIcon(): void {
    const ref = this.dialog.open(MaticonPickerComponent, {
      width: '520px',
      data: { current: this.icon() },
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: true,
    });

    ref.afterClosed().subscribe((selected?: string | null) => {
      if (selected !== undefined) {
        this.icon.set(selected || undefined);
      }
    });
  }

  cancel(): void {
    this.dialogRef.close();
  }

  save(): void {
    if (this.dateControl.invalid) {
      this.dateControl.markAsTouched();
      return;
    }

    const title = this.titleControl.value.trim() || this.translation.t('common.tileTypes.anniversary');
    const date = this.dateControl.value ? this.formatLocalDate(this.dateControl.value) : '';
    const updated: TileSetting = {
      ...this.data.tile,
      label: title,
      payload: {
        ...this.data.tile.payload,
        title,
        date,
        icon: this.icon()
      }
    };
    this.dialogRef.close(updated);
  }

  private formatLocalDate(date: Date): string {
    const y = date.getFullYear();
    const m = `${date.getMonth() + 1}`.padStart(2, '0');
    const d = `${date.getDate()}`.padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
