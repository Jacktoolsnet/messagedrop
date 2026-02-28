import { CommonModule } from '@angular/common';
import { Component, HostListener, OnDestroy, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatDialogRef } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import { DisplayMessage } from '../../utils/display-message/display-message.component';
import { TranslationHelperService } from '../../../services/translation-helper.service';

@Component({
  selector: 'app-createpin',
  imports: [
    CommonModule,
    MatIcon,
    MatInputModule,
    MatButtonModule,
    TranslocoPipe
  ],
  templateUrl: './create-pin.component.html',
  styleUrl: './create-pin.component.css'
})
export class CreatePinComponent implements OnDestroy {
  pin = '';
  pinLength = 6;
  confirmPin = '';
  pinDisplay: string[] = ['', '', '', '', '', ''];
  confirmPinDisplay: string[] = ['', '', '', '', '', ''];
  isConfirming = false;
  private dialogClosed = false;

  private readonly dialogRef = inject(MatDialogRef<CreatePinComponent>);
  private readonly dialog = inject(MatDialog);
  private readonly translation = inject(TranslationHelperService);

  ngOnDestroy(): void {
    this.dialogClosed = true;
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboardInput(event: KeyboardEvent): void {
    const key = event.key;

    if (/^[0-9]$/.test(key)) {
      this.addDigit(key);
    } else if (key === 'Backspace') {
      this.removeDigit();
    }
  }

  get currentPinIndex(): number {
    return this.isConfirming ? this.confirmPin.length : this.pin.length;
  }

  addDigit(digit: string): void {
    if (!this.isConfirming) {
      if (this.pin.length < this.pinLength) {
        this.pin += digit;
        this.showDigitTemporarily(this.pin.length - 1);

        if (this.pin.length === this.pinLength) {
          setTimeout(() => {
            this.isConfirming = true;
          }, 250);
        }
      }
    } else {
      if (this.confirmPin.length < this.pinLength) {
        this.confirmPin += digit;
        this.showDigitTemporarily(this.confirmPin.length - 1, true);

        if (this.confirmPin.length === this.pinLength) {
          // Auto-check and close if it matches.
          setTimeout(() => {
            if (this.confirmPin === this.pin && !this.dialogClosed) {
              this.dialogClosed = true;
              this.dialogRef.close(this.pin);
            } else {
              this.reset();
              this.showPinMismatchMessage();
            }
          }, 250);
        }
      }
    }
  }

  showDigitTemporarily(index: number, isConfirming = false): void {
    const displayArray = isConfirming ? this.confirmPinDisplay : this.pinDisplay;
    const pin = isConfirming ? this.confirmPin : this.pin;
    displayArray[index] = pin[index];
    setTimeout(() => {
      displayArray[index] = '•';
    }, 250);
  }

  removeDigit(): void {
    if (!this.isConfirming && this.pin.length > 0) {
      const index = this.pin.length - 1;
      this.pin = this.pin.slice(0, -1);
      this.pinDisplay[index] = '';
    } else if (this.isConfirming && this.confirmPin.length > 0) {
      const index = this.confirmPin.length - 1;
      this.confirmPin = this.confirmPin.slice(0, -1);
      this.confirmPinDisplay[index] = '';
    }
  }

  reset(): void {
    this.pin = '';
    this.confirmPin = '';
    this.pinDisplay = ['', '', '', '', '', ''];
    this.confirmPinDisplay = ['', '', '', '', '', ''];
    this.isConfirming = false;
  }

  cancel(): void {
    this.dialogClosed = true;
    this.dialogRef.close();
  }

  private showPinMismatchMessage(): void {
    this.dialog.open(DisplayMessage, {
      panelClass: '',
      closeOnNavigation: false,
      data: {
        showAlways: true,
        title: this.translation.t('common.pin.title'),
        image: '',
        icon: 'warning',
        message: this.translation.t('common.pin.mismatch'),
        button: this.translation.t('common.actions.ok'),
        delay: 0,
        showSpinner: false,
        autoclose: false
      },
      maxWidth: '90vw',
      maxHeight: '90vh',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: false
    });
  }
}
