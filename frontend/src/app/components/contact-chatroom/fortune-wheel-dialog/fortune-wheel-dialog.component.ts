import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import { MAX_WHEEL_ENTRIES, MAX_WHEEL_ENTRY_LENGTH, MIN_WHEEL_ENTRIES, normalizeWheelEntries } from '../../../utils/fortune-wheel';
import { DialogHeaderComponent } from '../../utils/dialog-header/dialog-header.component';

export interface FortuneWheelDialogData { entries?: string[]; settings?: boolean; }
export interface FortuneWheelDialogResult { entries: string[]; }

@Component({
  selector: 'app-fortune-wheel-dialog',
  standalone: true,
  imports: [FormsModule, DialogHeaderComponent, MatButtonModule, MatDialogActions, MatDialogContent,
    MatFormFieldModule, MatIconModule, MatInputModule, TranslocoPipe],
  templateUrl: './fortune-wheel-dialog.component.html',
  styleUrl: './fortune-wheel-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FortuneWheelDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<FortuneWheelDialogComponent, FortuneWheelDialogResult>);
  private readonly data = inject<FortuneWheelDialogData | null>(MAT_DIALOG_DATA, { optional: true });
  readonly settings = this.data?.settings === true;
  readonly entries = signal([...(this.data?.entries ?? ['', ''])]);
  readonly valid = computed(() => normalizeWheelEntries(this.entries()) !== null);
  readonly maxEntryLength = MAX_WHEEL_ENTRY_LENGTH;
  readonly canAdd = computed(() => this.entries().length < MAX_WHEEL_ENTRIES);
  readonly canRemove = computed(() => this.entries().length > MIN_WHEEL_ENTRIES);

  updateEntry(index: number, value: string): void {
    this.entries.update(entries => entries.map((entry, entryIndex) => entryIndex === index ? value : entry));
  }
  addEntry(): void { if (this.canAdd()) this.entries.update(entries => [...entries, '']); }
  removeEntry(index: number): void { if (this.canRemove()) this.entries.update(entries => entries.filter((_, entryIndex) => entryIndex !== index)); }
  submit(): void {
    const entries = normalizeWheelEntries(this.entries());
    if (entries) this.dialogRef.close({ entries });
  }
  close(): void { this.dialogRef.close(); }
}
