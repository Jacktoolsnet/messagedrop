import { CommonModule } from '@angular/common';
import { Component, HostListener } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PinHintComponent } from '../pin-hint/pin-hint.component';

@Component({
  selector: 'app-createpin',
  imports: [
    CommonModule,
    MatIcon,
    MatInputModule,
    MatButtonModule,
    MatSnackBarModule
  ],
  templateUrl: './create-pin.component.html',
  styleUrl: './create-pin.component.css'
})
export class CreatePinComponent {
  pin: string = '';
  pinLength: number = 6;
  confirmPin: string = '';
  pinDisplay: string[] = ['', '', '', '', '', ''];
  confirmPinDisplay: string[] = ['', '', '', '', '', ''];
  isConfirming: boolean = false;
  private dialogClosed = false;

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

  constructor(
    private pinHintDialog: MatDialog,
    private dialogRef: MatDialogRef<CreatePinComponent>,
    private snackBar: MatSnackBar
  ) { }

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
          // Automatisch prüfen & ggf. schließen
          setTimeout(() => {
            if (this.confirmPin === this.pin && !this.dialogClosed) {
              this.dialogClosed = true;
              this.dialogRef.close(this.pin);
            } else {
              this.snackBar.open('PINs do not match', '', {
                duration: 2000,
                horizontalPosition: 'center',
                verticalPosition: 'top'
              });
              this.reset();
            }
          }, 250);
        }
      }
    }
  }

  showDigitTemporarily(index: number, isConfirming: boolean = false): void {
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

  showPinHint(): void {
    const dialogRef = this.pinHintDialog.open(PinHintComponent, {
      closeOnNavigation: true,
      hasBackdrop: true
    });

    dialogRef.afterOpened().subscribe(e => { });

    dialogRef.afterClosed().subscribe(result => { });
  }
}
