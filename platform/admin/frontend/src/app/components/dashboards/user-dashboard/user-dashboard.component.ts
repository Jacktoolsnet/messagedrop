import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../services/auth/auth.service';
import { UserService } from '../../../services/user/user.service';

@Component({
  selector: 'app-user-dashboard',
  standalone: true,
  templateUrl: './user-dashboard.component.html',
  styleUrls: ['./user-dashboard.component.scss'],
  imports: [
    RouterLink,
    MatToolbarModule,
    MatIconModule,
    MatButtonModule
  ]
})
export class UserDashboardComponent {
  private router = inject(Router);
  private userService = inject(UserService);
  private autService = inject(AuthService);

  readonly users = this.userService.users;
  readonly username = this.autService.username;
  readonly role = this.autService.role;

  goBack() {
    this.router.navigate(['/dashboard']);
  }
}