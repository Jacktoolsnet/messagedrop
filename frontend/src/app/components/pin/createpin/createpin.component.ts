import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogRef } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

@Component({
  selector: 'app-createpin',
  imports: [
    CommonModule,
    MatIcon,
    MatInputModule,
    MatButtonModule,
    MatSnackBarModule
  ],
  templateUrl: './createpin.component.html',
  styleUrl: './createpin.component.css'
})
export class CreatePinComponent {
  pin: string = '';
  confirmPin: string = '';
  pinDisplay: string[] = ['', '', '', ''];
  confirmPinDisplay: string[] = ['', '', '', ''];
  isConfirming: boolean = false;

  constructor(
    private dialogRef: MatDialogRef<CreatePinComponent>,
    private snackBar: MatSnackBar
  ) { }

  get currentPinIndex(): number {
    return this.isConfirming ? this.confirmPin.length : this.pin.length;
  }

  addDigit(digit: string): void {
    if (!this.isConfirming) {
      if (this.pin.length < 4) {
        this.pin += digit;
        this.showDigitTemporarily(this.pin.length - 1);

        if (this.pin.length === 4) {
          setTimeout(() => {
            this.isConfirming = true;
          }, 500);
        }
      }
    } else {
      if (this.confirmPin.length < 4) {
        this.confirmPin += digit;
        this.showDigitTemporarily(this.confirmPin.length - 1, true);

        if (this.confirmPin.length === 4) {
          // Automatisch prüfen & ggf. schließen
          setTimeout(() => {
            if (this.confirmPin === this.pin) {
              this.dialogRef.close(this.pin);
            } else {
              this.snackBar.open('PINs do not match', '', {
                duration: 2000,
                horizontalPosition: 'center',
                verticalPosition: 'top'
              });
              this.reset();
            }
          }, 1000); // erst nach Anzeige der letzten Ziffer prüfen
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
    }, 1000);
  }

  reset(): void {
    this.pin = '';
    this.confirmPin = '';
    this.pinDisplay = ['', '', '', ''];
    this.confirmPinDisplay = ['', '', '', ''];
    this.isConfirming = false;
  }

  confirm(): void {
    if (this.pin === this.confirmPin && this.pin.length === 4) {
      this.dialogRef.close(this.pin);
    } else {
      alert('PINs stimmen nicht überein');
      this.reset();
    }
  }
}
