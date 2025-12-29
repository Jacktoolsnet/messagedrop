import { Component, OnInit, computed, inject, signal } from '@angular/core';
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

  readonly errorCountToday = signal<number | null>(null);
  readonly infoCountToday = signal<number | null>(null);
  readonly appErrorCountToday = signal<number | null>(null);
  readonly powCountToday = signal<number | null>(null);
  readonly moderationCountPending = signal<number | null>(null);

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
      this.errorCountToday.set(res.count);
    });
    this.logService.getInfoCountSince(since).subscribe(res => {
      this.infoCountToday.set(res.count);
    });
    this.logService.getFrontendErrorCountSince(since).subscribe(res => {
      this.appErrorCountToday.set(res.count);
    });
    this.logService.getPowCountSince(since).subscribe(res => {
      this.powCountToday.set(res.count);
    });
    this.moderationService.countRequests('pending').subscribe({
      next: (res) => {
        const count = Number(res.count);
        const safeCount = Number.isFinite(count) ? count : 0;
        this.moderationCountPending.set(safeCount);
        if (safeCount === 0) {
          this.moderationService.listRequests('pending', 200, 0).subscribe({
            next: (fallback) => {
              const fallbackCount = fallback.rows?.length ?? 0;
              if (fallbackCount > 0) {
                this.moderationCountPending.set(fallbackCount);
              }
            },
            error: () => { }
          });
        }
      },
      error: () => {
        this.moderationCountPending.set(0);
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
