import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogRef } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

@Component({
  selector: 'app-check-pin',
  imports: [
    CommonModule,
    MatIcon,
    MatInputModule,
    MatButtonModule,
    MatSnackBarModule
  ],
  templateUrl: './check-pin.component.html',
  styleUrl: './check-pin.component.css'
})
export class CheckPinComponent {
  pin: string = '';
  confirmPin: string = '';
  pinDisplay: string[] = ['', '', '', ''];

  constructor(
    private dialogRef: MatDialogRef<CheckPinComponent>,
    private snackBar: MatSnackBar
  ) { }

  get currentPinIndex(): number {
    return this.pin.length;
  }

  addDigit(digit: string): void {
    if (this.pin.length < 4) {
      this.pin += digit;
      this.showDigitTemporarily(this.pin.length - 1);

      if (this.pin.length === 4) {
        setTimeout(() => {
        }, 500);
      }
    }
  }

  showDigitTemporarily(index: number, isConfirming: boolean = false): void {
    const displayArray = this.pinDisplay;
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
  }

  confirm(): void {
    // Todo: check if pin is correct
    if (this.pin.length === 4) {
      this.dialogRef.close(this.pin);
    } else {
      alert('PINs stimmen nicht überein');
      this.reset();
    }
  }
}
