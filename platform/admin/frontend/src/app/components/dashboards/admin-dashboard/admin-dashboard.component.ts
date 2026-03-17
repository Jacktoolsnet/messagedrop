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
import { CONTENT_MODULE_ROLES, DSA_MODULE_ROLES, MODERATION_MODULE_ROLES, ROOT_ADMIN_ROLES, USER_MODULE_ROLES, hasAllowedRole } from '../../../utils/admin-role-access';

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
  readonly canAccessUsers = computed(() => hasAllowedRole(this.role(), USER_MODULE_ROLES));
  readonly canManageMaintenance = computed(() => hasAllowedRole(this.role(), ROOT_ADMIN_ROLES));
  readonly canManageContent = computed(() => hasAllowedRole(this.role(), CONTENT_MODULE_ROLES));
  readonly canAccessDsa = computed(() => hasAllowedRole(this.role(), DSA_MODULE_ROLES));
  readonly canAccessModeration = computed(() => hasAllowedRole(this.role(), MODERATION_MODULE_ROLES));
  readonly canAccessLogs = computed(() => hasAllowedRole(this.role(), ROOT_ADMIN_ROLES));
  readonly canAccessStatistics = computed(() => hasAllowedRole(this.role(), ROOT_ADMIN_ROLES));

  readonly errorCountToday = signal<number | null>(null);
  readonly infoCountToday = signal<number | null>(null);
  readonly warnCountToday = signal<number | null>(null);
  readonly appErrorCountToday = signal<number | null>(null);
  readonly powCountToday = signal<number | null>(null);
  readonly moderationCountPending = signal<number | null>(null);

  readonly dsaTodoCount = computed(() => {
    const noticeStats = this.dsaService.noticeStats();
    const signalsOpen = this.dsaService.signalStats()?.total ?? 0;
    const noticesNew = noticeStats?.byStatus?.['RECEIVED'] ?? 0;
    const noticesInWork = noticeStats?.byStatus?.['UNDER_REVIEW'] ?? 0;
    return noticesNew + noticesInWork + signalsOpen;
  });

  readonly dsaTodoBadge = computed(() => {
    const total = this.dsaTodoCount();
    if (total <= 0) return '';
    return total >= 10 ? '10+' : String(total);
  });

  ngOnInit(): void {
    this.refreshCounts();
    if (this.canAccessDsa()) {
      this.dsaService.loadAllStats();
    }
  }

  private startOfTodayUtc(): number {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    return d.getTime();
  }

  refreshCounts() {
    const since = this.startOfTodayUtc();
    if (this.canAccessLogs()) {
      this.logService.getErrorCountSince(since).subscribe(res => {
        this.errorCountToday.set(res.count);
      });
      this.logService.getInfoCountSince(since).subscribe(res => {
        this.infoCountToday.set(res.count);
      });
      this.logService.getWarnCountSince(since).subscribe(res => {
        this.warnCountToday.set(res.count);
      });
      this.logService.getFrontendErrorCountSince(since).subscribe(res => {
        this.appErrorCountToday.set(res.count);
      });
      this.logService.getPowCountSince(since).subscribe(res => {
        this.powCountToday.set(res.count);
      });
    } else {
      this.errorCountToday.set(null);
      this.infoCountToday.set(null);
      this.warnCountToday.set(null);
      this.appErrorCountToday.set(null);
      this.powCountToday.set(null);
    }

    if (this.canAccessModeration()) {
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
              error: () => this.moderationCountPending.set(safeCount)
            });
          }
        },
        error: () => {
          this.moderationCountPending.set(0);
        }
      });
    } else {
      this.moderationCountPending.set(null);
    }
  }

  goToUserDashboard() {
    this.router.navigate(['/dashboard/user']);
  }

  logout() {
    this.authService.logout();
  }
}
