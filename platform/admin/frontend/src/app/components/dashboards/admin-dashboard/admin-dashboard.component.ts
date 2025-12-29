import { Component, OnInit, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatBadgeModule } from '@angular/material/badge';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../services/auth/auth.service';
import { LogService } from '../../../services/log.service';
import { DsaService } from '../../../services/dsa/dsa/dsa.service';
import { ModerationService } from '../../../services/moderation.service';

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
  private dsaService = inject(DsaService);
  private moderationService = inject(ModerationService);

  readonly username = this.authService.username;
  readonly role = this.authService.role;

  errorCountToday: number | null = null;
  infoCountToday: number | null = null;
  appErrorCountToday: number | null = null;
  powCountToday: number | null = null;
  moderationCountPending: number | null = null;

  readonly dsaOpenCount = computed(() => {
    const noticesOpen = this.dsaService.noticeStats()?.open ?? 0;
    const signalsOpen = this.dsaService.signalStats()?.total ?? 0;
    return noticesOpen + signalsOpen;
  });

  readonly dsaOpenBadge = computed(() => {
    const total = this.dsaOpenCount();
    if (total <= 0) return '';
    return total >= 10 ? '10+' : String(total);
  });

  ngOnInit(): void {
    this.refreshCounts();
    this.dsaService.loadAllStats();
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
    this.logService.getFrontendErrorCountSince(since).subscribe(res => {
      this.appErrorCountToday = res.count;
    });
    this.logService.getPowCountSince(since).subscribe(res => {
      this.powCountToday = res.count;
    });
    this.moderationService.listRequests('pending', 500, 0).subscribe({
      next: (res) => {
        this.moderationCountPending = res.rows?.length ?? 0;
      },
      error: () => {
        this.moderationCountPending = 0;
      }
    });
  }

  goToUserDashboard() {
    this.router.navigate(['/dashboard/user']);
  }

  logout() {
    this.authService.logout();
  }
}
