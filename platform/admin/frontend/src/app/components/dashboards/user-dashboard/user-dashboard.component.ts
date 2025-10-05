import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../services/auth/auth.service';
import { UserService } from '../../../services/user/user.service';
import { CreateUserComponent } from '../../user/create-user.component';

@Component({
  selector: 'app-user-dashboard',
  standalone: true,
  templateUrl: './user-dashboard.component.html',
  styleUrls: ['./user-dashboard.component.scss'],
  imports: [
    RouterLink,
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    MatDialogModule,
  ]
})
export class UserDashboardComponent {
  private dialog = inject(MatDialog);
  private router = inject(Router);
  private userService = inject(UserService);
  private authService = inject(AuthService);

  readonly users = this.userService.users;
  readonly username = this.authService.username;
  readonly role = this.authService.role;

  constructor() {
    this.userService.loadUsers();
  }

  openCreateUserDialog() {
    this.dialog.open(CreateUserComponent, {
      panelClass: 'glass-dialog'
    })
      .afterClosed()
      .subscribe((created) => {
        if (created) this.userService.loadUsers(); // refresh list
      });
  }

  isAdminOrRoot(): boolean {
    return ['admin', 'root'].includes(this.role()!);
  }
}