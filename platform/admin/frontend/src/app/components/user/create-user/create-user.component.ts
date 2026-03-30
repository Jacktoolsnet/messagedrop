
import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { CreateUserPayload } from '../../../interfaces/create-user-payload.interface';
import { TranslationHelperService } from '../../../services/translation-helper.service';
import { UserService } from '../../../services/user/user.service';

const USER_ROLES = ['author', 'editor', 'moderator', 'legal', 'admin'] as const;
const GENERATED_USERNAME_LENGTH = 8;
const USERNAME_CHARACTERS = 'abcdefghijklmnopqrstuvwxyz0123456789';

type UserRole = (typeof USER_ROLES)[number];

@Component({
  selector: 'app-create-user',
  templateUrl: './create-user.component.html',
  styleUrls: ['./create-user.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule
  ]
})
export class CreateUserComponent {
  private readonly dialogRef = inject(MatDialogRef<CreateUserComponent>);
  private readonly userService = inject(UserService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  readonly i18n = inject(TranslationHelperService);
  readonly roles = USER_ROLES;

  readonly form = this.fb.nonNullable.group({
    username: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
    role: ['author' as UserRole, Validators.required]
  });

  constructor() {
    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.clearSubmitError());
  }

  generateUsername(): void {
    this.form.controls.username.setValue(this.createRandomUsername());
    this.form.controls.username.markAsDirty();
    this.form.controls.username.markAsTouched();
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const rawValue = this.form.getRawValue();

    const payload: CreateUserPayload = {
      username: rawValue.username.trim(),
      email: rawValue.email.trim().toLowerCase(),
      password: rawValue.password,
      role: rawValue.role
    };

    this.userService.createUser(payload).subscribe({
      next: () => this.dialogRef.close(true),
      error: (error: unknown) => this.form.setErrors({ submitFailed: this.resolveErrorMessage(error) })
    });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }

  roleLabel(role: string): string {
    switch (role) {
      case 'author':
        return this.i18n.t('Author');
      case 'editor':
        return this.i18n.t('Editor');
      case 'moderator':
        return this.i18n.t('Moderator');
      case 'legal':
        return this.i18n.t('Legal');
      case 'admin':
        return this.i18n.t('Admin');
      default:
        return role;
    }
  }

  private resolveErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const backendMessage = error.error?.message || error.error?.error || error.message;
      if (typeof backendMessage === 'string' && backendMessage.trim()) {
        return backendMessage.trim();
      }
    }
    return this.i18n.t('User could not be created.');
  }

  private createRandomUsername(length = GENERATED_USERNAME_LENGTH): string {
    const randomValues = globalThis.crypto?.getRandomValues?.(new Uint32Array(length));

    if (randomValues) {
      return Array.from(
        randomValues,
        (value) => USERNAME_CHARACTERS[value % USERNAME_CHARACTERS.length]
      ).join('');
    }

    return Array.from(
      { length },
      () => USERNAME_CHARACTERS[Math.floor(Math.random() * USERNAME_CHARACTERS.length)]
    ).join('');
  }

  private clearSubmitError(): void {
    const currentErrors = this.form.errors;
    if (!currentErrors?.['submitFailed']) {
      return;
    }

    const { submitFailed: _submitFailed, ...remainingErrors } = currentErrors;
    this.form.setErrors(Object.keys(remainingErrors).length > 0 ? remainingErrors : null);
  }
}
