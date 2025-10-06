import { Component, inject } from '@angular/core';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../services/auth/auth.service';

type DsaTile = {
  title: string;
  subtitle: string;
  icon: string;
  route: string;
  count?: number; // offene Aufgaben (optional)
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
    MatBadgeModule
  ],
  templateUrl: './dsa-dashboard.component.html',
  styleUrls: ['./dsa-dashboard.component.css']
})
export class DsaDashboardComponent {
  private router = inject(Router);
  private auth = inject(AuthService);

  // Signals aus dem AuthService weiterreichen
  get username() { return this.auth.username; }
  get role() { return this.auth.role; }

  // Kacheln – Counters sind Platzhalter; später via Service befüllen
  tiles: DsaTile[] = [
    { title: 'Notices', subtitle: 'Incoming reports', icon: 'report_problem', route: '/dashboard/dsa/notices', count: 3 },
    { title: 'Decisions', subtitle: 'Review & decide', icon: 'gavel', route: '/dashboard/dsa/decisions', count: 1 },
    { title: 'Evidence', subtitle: 'Upload & manage proofs', icon: 'folder_shared', route: '/dashboard/dsa/evidence' },
    { title: 'Notifications', subtitle: 'Notify users & authorities', icon: 'notifications', route: '/dashboard/dsa/notifications' },
    { title: 'Appeals', subtitle: 'Handle appeals', icon: 'feedback', route: '/dashboard/dsa/appeals' },
    { title: 'Audit Log', subtitle: 'Trace all actions', icon: 'history', route: '/dashboard/dsa/audit-log' },
    { title: 'Transparency', subtitle: 'Public stats & reports', icon: 'insights', route: '/dashboard/dsa/transparency' }
  ];

  logout() { this.auth.logout(); }
}