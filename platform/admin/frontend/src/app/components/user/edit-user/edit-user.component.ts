
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { UpdateUserPayload } from '../../../interfaces/update-user-payload.interface';
import { User } from '../../../interfaces/user.interface';
import { UserService } from '../../../services/user/user.service';

export interface EditUserData {
  user: User;
  canChangeUsername: boolean;
  canChangeEmail: boolean;
  canChangeRole: boolean;
  isSelf: boolean;
}

@Component({
  selector: 'app-edit-user',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule
],
  templateUrl: './edit-user.component.html',
  styleUrls: ['./edit-user.component.css']
})
export class EditUserComponent {
  private dialogRef = inject(MatDialogRef<EditUserComponent, boolean>);
  private data = inject<EditUserData>(MAT_DIALOG_DATA);
  private fb = inject(FormBuilder);
  private userService = inject(UserService);

  user = this.data.user;
  canChangeUsername = this.data.canChangeUsername;
  canChangeEmail = this.data.canChangeEmail;
  canChangeRole = this.data.canChangeRole;
  isSelf = this.data.isSelf;

  form = this.fb.group({
    username: [{ value: this.user.username, disabled: !this.canChangeUsername }, [Validators.required, Validators.minLength(3)]],
    email: [{ value: this.user.email, disabled: !this.canChangeEmail }, [Validators.required, Validators.email]],
    password: [''], // optional; nur senden, wenn nicht leer
    role: [{ value: this.user.role, disabled: !this.canChangeRole }, Validators.required]
  });

  submit() {
    if (this.form.invalid) return;

    interface FormValue {
      username: string;
      email: string;
      password: string;
      role: UpdateUserPayload['role'];
    }
    const raw = this.form.getRawValue() as FormValue;
    const payload: UpdateUserPayload = {};

    // nur setzen, wenn erlaubt und geändert
    if (this.canChangeUsername && raw.username && raw.username !== this.user.username) {
      payload.username = raw.username.trim();
    }
    if (this.canChangeEmail && raw.email && raw.email.trim().toLowerCase() !== this.user.email.toLowerCase()) {
      payload.email = raw.email.trim().toLowerCase();
    }
    if (raw.password && raw.password.trim().length > 0) {
      payload.password = raw.password.trim();
    }
    if (this.canChangeRole && raw.role !== this.user.role) {
      payload.role = raw.role;
    }

    if (Object.keys(payload).length === 0) {
      this.dialogRef.close(false);
      return;
    }

    this.userService.updateUser(this.user.id, payload).subscribe({
      next: () => this.dialogRef.close(true),
      error: () => this.dialogRef.close(false)
    });
  }

  cancel() {
    this.dialogRef.close(false);
  }
}
