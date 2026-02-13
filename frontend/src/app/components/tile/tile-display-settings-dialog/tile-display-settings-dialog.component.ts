import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogContent, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import { MaticonPickerComponent } from '../../utils/maticon-picker/maticon-picker.component';
import { DialogHeaderComponent } from '../../utils/dialog-header/dialog-header.component';

export interface TileDisplaySettingsDialogData {
  title: string;
  icon?: string;
  fallbackTitle: string;
  dialogTitleKey?: string;
}

export interface TileDisplaySettingsDialogResult {
  title: string;
  icon?: string;
}

@Component({
  selector: 'app-tile-display-settings-dialog',
  standalone: true,
  imports: [
    DialogHeaderComponent,
    ReactiveFormsModule,
    MatDialogModule,
    MatDialogContent,
    MatDialogActions,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIcon,
    TranslocoPipe
  ],
  templateUrl: './tile-display-settings-dialog.component.html',
  styleUrl: './tile-display-settings-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TileDisplaySettingsDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<TileDisplaySettingsDialogComponent, TileDisplaySettingsDialogResult | undefined>);
  private readonly dialog = inject(MatDialog);
  readonly data = inject<TileDisplaySettingsDialogData>(MAT_DIALOG_DATA);

  readonly titleControl = new FormControl(this.data.title, { nonNullable: true });
  readonly icon = signal<string | undefined>(this.data.icon);

  pickIcon(): void {
    const ref = this.dialog.open(MaticonPickerComponent, {
      width: '520px',
      data: { current: this.icon() },
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
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
    const title = this.titleControl.value.trim() || this.data.fallbackTitle;
    this.dialogRef.close({
      title,
      icon: this.icon()
    });
  }
}
