import { Component, OnInit, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatBadgeModule } from '@angular/material/badge';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../services/auth/auth.service';
import { LogService } from '../../../services/log.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    RouterLink,
    MatIconModule,
    MatBadgeModule,
    MatButtonModule,
    MatCardModule,
    MatToolbarModule
  ],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css']
})
export class AdminDashboardComponent implements OnInit {
  private router = inject(Router);
  private authService = inject(AuthService);
  private logService = inject(LogService);

  readonly username = this.authService.username;
  readonly role = this.authService.role;

  errorCountToday: number | null = null;
  infoCountToday: number | null = null;

  ngOnInit(): void {
    this.refreshCounts();
  }

  private startOfTodayUtc(): number {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    return d.getTime();
  }

  refreshCounts() {
    const since = this.startOfTodayUtc();
    this.logService.getErrorCountSince(since).subscribe(res => {
      this.errorCountToday = res.count;
    });
    this.logService.getInfoCountSince(since).subscribe(res => {
      this.infoCountToday = res.count;
    });
  }

  goToUserDashboard() {
    this.router.navigate(['/dashboard/user']);
  }

  logout() {
    this.authService.logout();
  }
}
