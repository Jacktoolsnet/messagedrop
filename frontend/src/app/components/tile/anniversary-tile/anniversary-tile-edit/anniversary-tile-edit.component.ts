
import { A11yModule } from '@angular/cdk/a11y';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ViewChild, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatNativeDateModule, provideNativeDateAdapter } from '@angular/material/core';
import { MatCalendar, MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogContent, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import { TileSetting } from '../../../../interfaces/tile-settings';
import { TranslationHelperService } from '../../../../services/translation-helper.service';
import { HelpDialogService } from '../../../utils/help-dialog/help-dialog.service';
import { DialogHeaderComponent } from '../../../utils/dialog-header/dialog-header.component';
import {
  TileDisplaySettingsDialogComponent,
  TileDisplaySettingsDialogData,
  TileDisplaySettingsDialogResult
} from '../../tile-display-settings-dialog/tile-display-settings-dialog.component';

interface AnniversaryTileDialogData {
  tile: TileSetting;
  onTileCommit?: (updated: TileSetting) => void;
}

@Component({
  selector: 'app-anniversary-tile-edit',
  standalone: true,
  providers: [provideNativeDateAdapter()],
  imports: [
    DialogHeaderComponent,
    ReactiveFormsModule,
    MatDialogModule,
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
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly translation = inject(TranslationHelperService);
  readonly help = inject(HelpDialogService);
  readonly data = inject<AnniversaryTileDialogData>(MAT_DIALOG_DATA);
  private readonly fallbackTitle = this.translation.t('common.tileTypes.anniversary');

  readonly titleControl = new FormControl(
    this.data.tile.payload?.title ?? this.data.tile.label ?? this.fallbackTitle,
    { nonNullable: true }
  );
  readonly dateControl = new FormControl<Date | null>(this.toDate(this.data.tile.payload?.date), { validators: [Validators.required] });
  readonly icon = signal<string | undefined>(this.data.tile.payload?.icon ?? 'event');

  get headerTitle(): string {
    return this.titleControl.value.trim() || this.fallbackTitle;
  }

  get headerIcon(): string {
    return this.icon() || 'event';
  }

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

  openDisplaySettings(): void {
    const ref = this.dialog.open<TileDisplaySettingsDialogComponent, TileDisplaySettingsDialogData, TileDisplaySettingsDialogResult | undefined>(
      TileDisplaySettingsDialogComponent,
      {
        width: '460px',
        maxWidth: '95vw',
        data: {
          title: this.headerTitle,
          icon: this.icon(),
          fallbackTitle: this.fallbackTitle,
          dialogTitleKey: 'common.tileEdit.displaySettingsTitle'
        },
        hasBackdrop: true,
        backdropClass: 'dialog-backdrop',
        disableClose: false,
      }
    );

    ref.afterClosed().subscribe((result) => {
      if (!result) {
        return;
      }
      this.titleControl.setValue(result.title);
      this.icon.set(result.icon);
      this.cdr.markForCheck();
      this.commitDisplaySettings();
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

    const updated = this.buildUpdatedTile();
    this.dialogRef.close(updated);
  }

  private commitDisplaySettings(): void {
    const title = this.titleControl.value.trim() || this.fallbackTitle;
    const updated: TileSetting = {
      ...this.data.tile,
      label: title,
      payload: {
        ...this.data.tile.payload,
        title,
        icon: this.icon()
      }
    };
    this.data.tile = updated;
    this.data.onTileCommit?.(updated);
  }

  private buildUpdatedTile(): TileSetting {
    const title = this.titleControl.value.trim() || this.fallbackTitle;
    const date = this.dateControl.value ? this.formatLocalDate(this.dateControl.value) : '';
    return {
      ...this.data.tile,
      label: title,
      payload: {
        ...this.data.tile.payload,
        title,
        date,
        icon: this.icon()
      }
    };
  }

  private formatLocalDate(date: Date): string {
    const y = date.getFullYear();
    const m = `${date.getMonth() + 1}`.padStart(2, '0');
    const d = `${date.getDate()}`.padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
