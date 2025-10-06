import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { CreateUserPayload } from '../../../interfaces/create-user-payload.interface';
import { UserService } from '../../../services/user/user.service';

@Component({
  selector: 'app-create-user',
  standalone: true,
  templateUrl: './create-user.component.html',
  styleUrls: ['./create-user.component.css'],
  imports: [
    CommonModule,
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

  form = this.fb.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
    role: ['moderator', Validators.required]
  });

  submit() {
    if (this.form.invalid) return;

    const payload: CreateUserPayload = {
      username: this.form.value.username!,
      password: this.form.value.password!,
      role: this.form.value.role ?? 'moderator'
    };

    this.userService.createUser(payload).subscribe({
      next: () => this.dialogRef.close(true)
    });
  }

  cancel() {
    this.dialogRef.close(false);
  }
}