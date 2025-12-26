
import { Component, ElementRef, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoPipe } from '@jsverse/transloco';
import { Contact } from '../../../interfaces/contact';
import { Mode } from '../../../interfaces/mode';
import { TranslationHelperService } from '../../../services/translation-helper.service';

@Component({
  selector: 'app-contact',
  imports: [
    FormsModule,
    MatButtonModule,
    MatDialogActions,
    MatDialogClose,
    MatDialogTitle,
    MatDialogContent,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    TranslocoPipe
],
  templateUrl: './connect.component.html',
  styleUrl: './connect.component.css'
})
export class ConnectComponent {
  @ViewChild('connectIdInput') connectIdInput?: ElementRef<HTMLInputElement>;
  private readonly snackBar = inject(MatSnackBar);
  private readonly translation = inject(TranslationHelperService);
  private readonly dialogRef = inject(MatDialogRef<ConnectComponent>);
  public readonly data = inject<{ mode: Mode; contact: Contact; connectId: string }>(MAT_DIALOG_DATA);
  public isPasting = false;

  onApplyClick(): void {
    this.dialogRef.close(this.data);
  }

  onAbortClick(): void {
    this.dialogRef.close();
  }

  public showPolicy() {
    this.snackBar.open(
      this.translation.t('common.contact.connect.policy'),
      this.translation.t('common.actions.ok'),
      {}
    );
  }

  async onPasteFromClipboard(event?: MouseEvent): Promise<void> {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }
    if (!navigator?.clipboard) {
      this.snackBar.open(this.translation.t('common.clipboard.unavailable'), this.translation.t('common.actions.ok'), {
        panelClass: ['snack-warning'],
        duration: 3000
      });
      return;
    }
    if (this.isPasting) return;
    this.isPasting = true;
    try {
      this.connectIdInput?.nativeElement?.blur();
      const text = await navigator.clipboard.readText();
      this.data.connectId = text.trim();
      queueMicrotask(() => this.connectIdInput?.nativeElement?.focus());
    } catch (err) {
      console.error('Failed to read clipboard', err);
      this.snackBar.open(this.translation.t('common.clipboard.readFailed'), this.translation.t('common.actions.ok'), {
        panelClass: ['snack-warning'],
        duration: 3000
      });
    } finally {
      this.isPasting = false;
    }
  }
}
