import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogRef } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { GetPinHashResponse } from '../../../interfaces/get-pin-hash-response';
import { IndexDbService } from '../../../services/index-db.service';
import { UserService } from '../../../services/user.service';

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
  showResetButton: boolean = false;
  pinDisplay: string[] = ['', '', '', ''];

  constructor(
    private userService: UserService,
    private indexDbService: IndexDbService,
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
          this.confirm();
        }, 500);
      }
    }
  }

  showDigitTemporarily(index: number, isConfirming: boolean = false): void {
    const displayArray = this.pinDisplay;
    const pin = this.pin;
    displayArray[index] = pin[index];
    setTimeout(() => {
      displayArray[index] = '•';
    }, 500);
  }

  reset(): void {
    this.pin = '';
    this.pinDisplay = ['', '', '', ''];
  }

  confirm(): void {
    // Todo: check if pin is correct
    if (this.pin.length === 4) {
      this.userService.getPinHash(this.pin)
        .subscribe(async (getPinHashResponse: GetPinHashResponse) => {
          if (!await this.indexDbService.checkPinHash(getPinHashResponse.pinHash)) {
            this.snackBar.open('Pin is not valid. Please try again.', '', {
              duration: 2000,
              horizontalPosition: 'center',
              verticalPosition: 'top'
            });
            this.reset();
            this.showResetButton = true;
          } else {
            this.showResetButton = false;
            this.dialogRef.close(this.pin);
          }
        });

    } else {
      alert('PINs stimmen nicht überein');
      this.reset();
    }
  }

  resetUser(): void {
    this.dialogRef.close(undefined);
  }
}
