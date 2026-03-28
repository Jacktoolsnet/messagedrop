import { ChangeDetectorRef, Component, ElementRef, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { RouterLink } from '@angular/router';
import { APP_VERSION_INFO } from '../../../environments/version';
import { AuthService } from '../../services/auth/auth.service';
import { TranslationHelperService } from '../../services/translation-helper.service';
import { DisplayMessageService } from '../../services/display-message.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
  standalone: true,
  imports: [
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    FormsModule,
    MatIconModule,
    RouterLink
  ]
})
export class LoginComponent {
  @ViewChild('otpInput') private otpInput?: ElementRef<HTMLInputElement>;

  readonly appVersion = APP_VERSION_INFO;
  readonly i18n = inject(TranslationHelperService);
  username = '';
  password = '';
  otpCode = '';
  challengeId: string | null = null;
  expiresAt: number | null = null;
  step: 'credentials' | 'otp' = 'credentials';
  loading = false;

  private readonly authService = inject(AuthService);
  private readonly snackBar = inject(DisplayMessageService);
  private readonly cdr = inject(ChangeDetectorRef);

  private runAsync(update: () => void) {
    queueMicrotask(() => {
      update();
      this.cdr.detectChanges();
    });
  }

  private switchToOtp(challengeId: string, expiresAt: number) {
    this.runAsync(() => {
      this.challengeId = challengeId;
      this.expiresAt = expiresAt;
      this.step = 'otp';

      queueMicrotask(() => {
        this.otpInput?.nativeElement?.focus();
      });
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
          this.snackBar.open(this.i18n.t('OTP was sent via Pushbullet. If available, it was also sent by email.'), undefined, {
            duration: 2000,
            panelClass: ['snack-success'],
            horizontalPosition: 'center',
            verticalPosition: 'top'
          });
        } else {
          this.snackBar.open(this.i18n.t('Unexpected login response.'), undefined, {
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
      this.snackBar.open(this.i18n.t('Please enter a 6-digit code.'), undefined, {
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
          this.snackBar.open(this.i18n.t('OTP could not be verified.'), undefined, {
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
        this.snackBar.open(this.i18n.t('OTP verification failed. Please try again.'), undefined, {
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
