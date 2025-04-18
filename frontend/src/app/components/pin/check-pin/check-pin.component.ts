import { CommonModule } from '@angular/common';
import { Component, HostListener } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogRef } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { CryptedUser } from '../../../interfaces/crypted-user';
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
  pinLength: number = 6;
  showResetButton: boolean = false;
  pinDisplay: string[] = ['', '', '', '', '', ''];

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
    private userService: UserService,
    private indexDbService: IndexDbService,
    private dialogRef: MatDialogRef<CheckPinComponent>,
    private snackBar: MatSnackBar
  ) { }

  get currentPinIndex(): number {
    return this.pin.length;
  }

  addDigit(digit: string): void {
    if (this.pin.length < this.pinLength) {
      this.pin += digit;
      this.showDigitTemporarily(this.pin.length - 1);

      if (this.pin.length === this.pinLength) {
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
    this.pinDisplay = ['', '', '', '', '', ''];
  }

  confirm(): void {
    // Todo: check if pin is correct
    if (this.pin.length === this.pinLength) {
      this.userService.getPinHash(this.pin)
        .subscribe(async (getPinHashResponse: GetPinHashResponse) => {
          console.log(getPinHashResponse);
          let cryptedUser: CryptedUser | undefined = await this.indexDbService.getUser();
          if (cryptedUser !== undefined) {
            console.log(cryptedUser);
            /*this.snackBar.open('Pin is not valid. Please try again.', '', {
              duration: 2000,
              horizontalPosition: 'center',
              verticalPosition: 'top'
            });
            this.reset();
            this.showResetButton = true;*/
          } /*else {
            this.showResetButton = false;
            this.dialogRef.close(this.pin);
          } */
        });
    }
  }

  removeDigit(): void {
    if (this.pin.length > 0) {
      const index = this.pin.length - 1;
      this.pin = this.pin.slice(0, -1);
      this.pinDisplay[index] = '';
    }
  }

  resetUser(): void {
    this.dialogRef.close(undefined);
  }
}
