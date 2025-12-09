import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthService } from '../../services/auth/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    FormsModule,
    MatIconModule,
    MatSnackBarModule
  ]
})
export class LoginComponent {
  username = '';
  password = '';
  otpCode = '';
  challengeId: string | null = null;
  expiresAt: number | null = null;
  step: 'credentials' | 'otp' = 'credentials';
  loading = false;

  private readonly authService = inject(AuthService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly cdr = inject(ChangeDetectorRef);

  private runAsync(update: () => void) {
    queueMicrotask(() => {
      update();
      this.cdr.detectChanges();
    });
  }

  private switchToOtp(challengeId: string, expiresAt: number) {
    // Defer to avoid ExpressionChangedAfterItHasBeenCheckedError
    this.runAsync(() => {
      this.challengeId = challengeId;
      this.expiresAt = expiresAt;
      this.step = 'otp';
    });
  }

  onSubmitCredentials() {
    if (this.loading) return;
    this.loading = true;
    this.authService.login({
      username: this.username,
      password: this.password
    }).subscribe({
      next: (response) => {
        this.runAsync(() => {
          this.loading = false;
        });
        if ('token' in response && response.token) {
          this.authService.completeLogin(response.token);
        } else if ('challengeId' in response) {
          this.switchToOtp(response.challengeId, response.expiresAt);
          this.snackBar.open('OTP wurde per Pushbullet gesendet.', undefined, {
            duration: 2000,
            panelClass: ['snack-success'],
            horizontalPosition: 'center',
            verticalPosition: 'top'
          });
        } else {
          this.snackBar.open('Unerwartete Login-Antwort.', undefined, {
            duration: 2000,
            panelClass: ['snack-error'],
            horizontalPosition: 'center',
            verticalPosition: 'top'
          });
        }
      },
      error: () => {
        this.runAsync(() => {
          this.loading = false;
        });
      }
    });
  }

  onSubmitOtp() {
    if (!this.challengeId || this.loading) return;
    const code = this.otpCode.trim();
    if (code.length !== 6) {
      this.snackBar.open('Bitte 6-stelligen Code eingeben.', undefined, {
        duration: 2000,
        panelClass: ['snack-warning'],
        horizontalPosition: 'center',
        verticalPosition: 'top'
      });
      return;
    }
    this.loading = true;
    this.cdr.detectChanges();
    this.authService.verifyOtp({
      challengeId: this.challengeId,
      otp: code
    }).subscribe({
      next: (response) => {
        this.runAsync(() => {
          this.loading = false;
        });
        if (response.token) {
          this.authService.completeLogin(response.token);
        } else {
          this.snackBar.open('OTP konnte nicht verifiziert werden.', undefined, {
            duration: 2000,
            panelClass: ['snack-error'],
            horizontalPosition: 'center',
            verticalPosition: 'top'
          });
        }
      },
      error: (err) => {
        this.runAsync(() => {
          this.loading = false;
        });
        console.error('OTP verify failed', err);
        this.snackBar.open('OTP-Verifikation fehlgeschlagen. Bitte erneut versuchen.', undefined, {
          duration: 2500,
          panelClass: ['snack-error'],
          horizontalPosition: 'center',
          verticalPosition: 'top'
        });
      }
    });
  }

  reset() {
    this.step = 'credentials';
    this.challengeId = null;
    this.expiresAt = null;
    this.otpCode = '';
    this.loading = false;
  }
}
