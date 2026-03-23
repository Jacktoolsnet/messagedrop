
import { Component, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { CreateUserPayload } from '../../../interfaces/create-user-payload.interface';
import { TranslationHelperService } from '../../../services/translation-helper.service';
import { UserService } from '../../../services/user/user.service';

@Component({
  selector: 'app-create-user',
  standalone: true,
  templateUrl: './create-user.component.html',
  styleUrls: ['./create-user.component.css'],
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
  private dialogRef = inject(MatDialogRef<CreateUserComponent>);
  private userService = inject(UserService);
  private fb = inject(FormBuilder);
  readonly i18n = inject(TranslationHelperService);
  readonly roles = ['author', 'editor', 'moderator', 'legal', 'admin'] as const;

  form = this.fb.group({
    username: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
    role: ['author', Validators.required]
  });

  submit() {
    if (this.form.invalid) return;

    const payload: CreateUserPayload = {
      username: this.form.value.username!,
      email: this.form.value.email!.trim().toLowerCase(),
      password: this.form.value.password!,
      role: this.form.value.role ?? 'moderator'
    };

    this.userService.createUser(payload).subscribe({
      next: () => this.dialogRef.close(true),
      error: (error: unknown) => this.form.setErrors({ submitFailed: this.resolveErrorMessage(error) })
    });
  }

  cancel() {
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
}
