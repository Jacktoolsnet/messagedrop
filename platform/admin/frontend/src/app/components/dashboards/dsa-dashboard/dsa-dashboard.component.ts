import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter, fromEvent, merge, startWith } from 'rxjs';

import { AuthService } from '../../../services/auth/auth.service';
import { DsaService } from '../../../services/dsa/dsa/dsa.service';
import { TranslationHelperService } from '../../../services/translation-helper.service';

type TileKey =
  | 'signals'
  | 'notices'
  | 'decisions'
  | 'evidence'
  | 'notifications'
  | 'appeals'
  | 'audit'
  | 'transparency'
  | 'userModeration';

interface DsaTile {
  key: TileKey;
  title: string;
  subtitle: string;
  icon: string;
  route: string;
}

@Component({
  selector: 'app-dsa-dashboard',
  standalone: true,
  imports: [
    RouterLink,
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    MatBadgeModule,
    MatProgressBarModule
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dsa-dashboard.component.html',
  styleUrls: ['./dsa-dashboard.component.css']
})
export class DsaDashboardComponent {
  private router = inject(Router);
  private auth = inject(AuthService);
  private dsa = inject(DsaService);
  private destroyRef = inject(DestroyRef);
  readonly i18n = inject(TranslationHelperService);

  // Auth-Signals weiterreichen
  get username() { return this.auth.username; }
  get role() { return this.auth.role; }

  // Lade beide Statistiken direkt beim Start
  constructor() {
    this.refreshStatsOnEnter();
  }

  // Reactive Helpers
  readonly loading = this.dsa.loading;
  readonly noticeStats = this.dsa.noticeStats;
  readonly signalStats = this.dsa.signalStats;
  readonly appealStats = this.dsa.appealStats;
  readonly openUserModerationAppealsCount = this.dsa.openUserModerationAppealsCount;

  // Kacheln
  tiles: DsaTile[] = [
    { key: 'signals', title: this.i18n.t('Signals'), subtitle: this.i18n.t('Open signals'), icon: 'info', route: '/dashboard/dsa/signals' },
    { key: 'notices', title: this.i18n.t('Notices'), subtitle: this.i18n.t('Incoming reports'), icon: 'report_problem', route: '/dashboard/dsa/notices' },
    { key: 'decisions', title: this.i18n.t('Decisions'), subtitle: this.i18n.t('Review & decide'), icon: 'gavel', route: '/dashboard/dsa/decisions' },
    { key: 'evidence', title: this.i18n.t('Evidence'), subtitle: this.i18n.t('Upload & manage proofs'), icon: 'folder_shared', route: '/dashboard/dsa/evidence' },
    { key: 'notifications', title: this.i18n.t('Notifications'), subtitle: this.i18n.t('Notify stakeholders'), icon: 'notifications', route: '/dashboard/dsa/notifications' },
    { key: 'appeals', title: this.i18n.t('Appeals'), subtitle: this.i18n.t('Handle appeals'), icon: 'feedback', route: '/dashboard/dsa/appeals' },
    { key: 'audit', title: this.i18n.t('Audit Log'), subtitle: this.i18n.t('Trace all actions'), icon: 'history', route: '/dashboard/dsa/audits' },
    { key: 'transparency', title: this.i18n.t('Transparency'), subtitle: this.i18n.t('Public stats & reports'), icon: 'insights', route: '/dashboard/dsa/transparency' },
    { key: 'userModeration', title: this.i18n.t('User Moderation'), subtitle: this.i18n.t('Block / unblock users'), icon: 'gpp_bad', route: '/dashboard/dsa/user-moderation' }
  ];

  // Badge-Logik pro Tile
  badgeCount = (tile: DsaTile) => {
    switch (tile.key) {
      case 'signals':
        // offene (nicht bearbeitete) Signals
        return this.signalStats()?.total ?? 0;
      case 'notices':
        // offene = alles außer DECIDED
        return this.noticeStats()?.open ?? 0;
      case 'appeals':
        return this.appealStats()?.open ?? 0;
      case 'userModeration':
        return this.openUserModerationAppealsCount();
      default:
        return 0; // für die anderen später erweitern
    }
  };

  showBadge = (tile: DsaTile) => {
    const c = this.badgeCount(tile);
    return Number(c) > 0;
  };

  badgeColor = (tile: DsaTile) => {
    switch (tile.key) {
      case 'notices': return 'warn';     // offene Reports = rot/warn
      case 'signals': return 'primary';  // 24h-Signals = primär
      case 'appeals': return 'accent';
      case 'userModeration': return 'warn';
      default: return 'primary';
    }
  };

  avatarClass = (tile: DsaTile) => {
    switch (tile.key) {
      case 'signals':
      case 'notifications':
      case 'appeals':
        return 'avatar avatar-accent';
      case 'notices':
      case 'userModeration':
        return 'avatar avatar-warn';
      case 'decisions':
      case 'transparency':
        return 'avatar avatar-success';
      case 'evidence':
      case 'audit':
      default:
        return 'avatar avatar-neutral';
    }
  };

  goBack() { this.router.navigate(['/dashboard']); }
  logout() { this.auth.logout(); }
  trackByKey = (_: number, t: DsaTile) => t.key;

  private refreshStatsOnEnter(): void {
    merge(
      this.router.events.pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        filter(event => event.urlAfterRedirects.startsWith('/dashboard/dsa')),
        startWith(null)
      ),
      fromEvent(window, 'focus'),
      fromEvent(document, 'visibilitychange').pipe(
        filter(() => document.visibilityState === 'visible')
      )
    ).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => this.dsa.loadAllStats());
  }
}
