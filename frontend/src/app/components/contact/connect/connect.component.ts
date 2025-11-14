import { CommonModule } from '@angular/common';
import { Component, ElementRef, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Contact } from '../../../interfaces/contact';
import { Mode } from '../../../interfaces/mode';

@Component({
  selector: 'app-contact',
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatDialogActions,
    MatDialogClose,
    MatDialogTitle,
    MatDialogContent,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule
  ],
  templateUrl: './connect.component.html',
  styleUrl: './connect.component.css'
})
export class ConnectComponent {
  @ViewChild('connectIdInput') connectIdInput?: ElementRef<HTMLInputElement>;
  private readonly snackBar = inject(MatSnackBar);
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
    this.snackBar.open(`Contact id, user id, contact user id and the subscribed flag is saved on our server. This informations are essential for the functionality of the application.`, 'OK', {});
  }

  async onPasteFromClipboard(event?: MouseEvent): Promise<void> {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }
    if (!navigator?.clipboard) {
      this.snackBar.open('Clipboard access is not available in this browser.', 'OK', {
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
      this.snackBar.open('Could not read clipboard content.', 'OK', {
        panelClass: ['snack-warning'],
        duration: 3000
      });
    } finally {
      this.isPasting = false;
    }
  }
}
