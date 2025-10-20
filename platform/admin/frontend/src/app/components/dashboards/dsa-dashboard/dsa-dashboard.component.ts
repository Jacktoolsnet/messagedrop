import { Component, inject } from '@angular/core';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../services/auth/auth.service';
import { DsaService } from '../../../services/dsa/dsa/dsa.service';

type TileKey =
  | 'signals'
  | 'notices'
  | 'decisions'
  | 'evidence'
  | 'notifications'
  | 'appeals'
  | 'audit'
  | 'transparency';

type DsaTile = {
  key: TileKey;
  title: string;
  subtitle: string;
  icon: string;
  route: string;
};

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
  templateUrl: './dsa-dashboard.component.html',
  styleUrls: ['./dsa-dashboard.component.css']
})
export class DsaDashboardComponent {
  private router = inject(Router);
  private auth = inject(AuthService);
  private dsa = inject(DsaService);

  // Auth-Signals weiterreichen
  get username() { return this.auth.username; }
  get role() { return this.auth.role; }

  // Lade beide Statistiken direkt beim Start
  constructor() {
    this.dsa.loadAllStats();
  }

  // Reactive Helpers
  readonly loading = this.dsa.loading;
  readonly noticeStats = this.dsa.noticeStats;
  readonly signalStats = this.dsa.signalStats;
  readonly appealStats = this.dsa.appealStats;

  // Kacheln
  tiles: DsaTile[] = [
    { key: 'signals', title: 'Signals', subtitle: 'Incoming signals (24h)', icon: 'info', route: '/dashboard/dsa/signals' },
    { key: 'notices', title: 'Notices', subtitle: 'Incoming reports', icon: 'report_problem', route: '/dashboard/dsa/notices' },
    { key: 'decisions', title: 'Decisions', subtitle: 'Review & decide', icon: 'gavel', route: '/dashboard/dsa/decisions' },
    { key: 'evidence', title: 'Evidence', subtitle: 'Upload & manage proofs', icon: 'folder_shared', route: '/dashboard/dsa/evidence' },
    { key: 'notifications', title: 'Notifications', subtitle: 'Notify stakeholders', icon: 'notifications', route: '/dashboard/dsa/notifications' },
    { key: 'appeals', title: 'Appeals', subtitle: 'Handle appeals', icon: 'feedback', route: '/dashboard/dsa/appeals' },
    { key: 'audit', title: 'Audit Log', subtitle: 'Trace all actions', icon: 'history', route: '/dashboard/dsa/audits' },
    { key: 'transparency', title: 'Transparency', subtitle: 'Public stats & reports', icon: 'insights', route: '/dashboard/dsa/transparency' }
  ];

  // Badge-Logik pro Tile
  badgeCount = (tile: DsaTile) => {
    switch (tile.key) {
      case 'signals':
        // Anzahl der letzten 24h
        return this.signalStats()?.last24h ?? 0;
      case 'notices':
        // offene = alles außer DECIDED
        return this.noticeStats()?.open ?? 0;
      case 'appeals':
        return this.appealStats()?.open ?? 0;
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
      default: return 'primary';
    }
  };

  goBack() { this.router.navigate(['/dashboard']); }
  logout() { this.auth.logout(); }
  trackByKey = (_: number, t: DsaTile) => t.key;
}
