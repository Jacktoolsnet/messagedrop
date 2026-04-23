import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import {
  CertificateHealthOverviewResponse,
  CertificateHealthStatus,
  CertificateHealthSummary,
  CertificateHealthTarget,
  CertificateHealthWorstStatus
} from '../../../interfaces/certificate-health.interface';
import { CertificateHealthService } from '../../../services/certificate-health.service';
import { DisplayMessageService } from '../../../services/display-message.service';
import { TranslationHelperService } from '../../../services/translation-helper.service';

@Component({
  selector: 'app-certificate-health-card',
  standalone: true,
  imports: [MatCardModule, MatButtonModule, MatIconModule],
  templateUrl: './certificate-health-card.component.html',
  styleUrl: './certificate-health-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CertificateHealthCardComponent {
  private readonly certificateHealthService = inject(CertificateHealthService);
  private readonly snackBar = inject(DisplayMessageService);
  private readonly destroyRef = inject(DestroyRef);
  readonly i18n = inject(TranslationHelperService);

  readonly loading = signal(true);
  readonly checking = signal(false);
  readonly summary = signal<CertificateHealthSummary | null>(null);
  readonly targets = signal<CertificateHealthTarget[]>([]);

  readonly hasTargets = computed(() => (this.summary()?.total ?? 0) > 0);
  readonly statusLabel = computed(() => this.resolveStatusLabel(this.summary()?.worstStatus ?? 'none'));
  readonly statusIcon = computed(() => this.resolveStatusIcon(this.summary()?.worstStatus ?? 'none'));

  constructor() {
    this.refresh();
  }

  refresh(): void {
    this.loading.set(true);
    this.certificateHealthService.getOverview()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.applyResponse(response);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.snackBar.open(this.i18n.t('Could not load certificate status.'), this.i18n.t('OK'), {
            duration: 3000,
            panelClass: ['snack-error'],
            horizontalPosition: 'center',
            verticalPosition: 'top'
          });
        }
      });
  }

  runCheck(): void {
    if (this.checking()) {
      return;
    }

    this.checking.set(true);
    this.certificateHealthService.runCheck()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.applyResponse(response);
          this.checking.set(false);
          this.snackBar.open(this.i18n.t('Certificate check finished.'), this.i18n.t('OK'), {
            duration: 2200,
            panelClass: ['snack-success'],
            horizontalPosition: 'center',
            verticalPosition: 'top'
          });
        },
        error: () => {
          this.checking.set(false);
          this.snackBar.open(this.i18n.t('Certificate check failed.'), this.i18n.t('OK'), {
            duration: 3200,
            panelClass: ['snack-error'],
            horizontalPosition: 'center',
            verticalPosition: 'top'
          });
        }
      });
  }

  trackByTargetKey(_index: number, target: CertificateHealthTarget): string {
    return target.targetKey;
  }

  badgeLabel(status: CertificateHealthWorstStatus): string {
    return this.resolveStatusLabel(status);
  }

  badgeIcon(status: CertificateHealthWorstStatus): string {
    return this.resolveStatusIcon(status);
  }

  formatDateTime(value: number | null | undefined): string {
    if (!Number.isFinite(Number(value))) {
      return '—';
    }

    return new Date(Number(value)).toLocaleString(this.i18n.dateLocale(), {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  }

  formatDate(value: number | null | undefined): string {
    if (!Number.isFinite(Number(value))) {
      return '—';
    }

    return new Date(Number(value)).toLocaleDateString(this.i18n.dateLocale(), {
      dateStyle: 'medium'
    });
  }

  formatDaysRemaining(value: number | null | undefined): string {
    if (!Number.isFinite(Number(value))) {
      return '—';
    }

    const days = Number(value);
    if (days < 0) {
      return this.i18n.t('Expired {{count}} day(s) ago', { count: Math.abs(days) });
    }
    if (days === 0) {
      return this.i18n.t('Expires today');
    }
    if (days === 1) {
      return this.i18n.t('1 day');
    }
    return this.i18n.t('{{count}} days', { count: days });
  }

  isAttentionStatus(status: CertificateHealthWorstStatus): boolean {
    return status === 'warning' || status === 'critical' || status === 'expired' || status === 'error';
  }

  resolveStatusClass(status: CertificateHealthWorstStatus): string {
    switch (status) {
      case 'ok':
        return 'status-ok';
      case 'warning':
        return 'status-warning';
      case 'critical':
        return 'status-critical';
      case 'expired':
        return 'status-expired';
      case 'error':
        return 'status-error';
      default:
        return 'status-none';
    }
  }

  private applyResponse(response: CertificateHealthOverviewResponse | null | undefined): void {
    this.summary.set(response?.summary ?? null);
    this.targets.set(Array.isArray(response?.targets) ? response.targets : []);
  }

  private resolveStatusLabel(status: CertificateHealthWorstStatus): string {
    switch (status) {
      case 'ok':
        return this.i18n.t('All certificates valid');
      case 'warning':
        return this.i18n.t('Expiring soon');
      case 'critical':
        return this.i18n.t('Critical');
      case 'expired':
        return this.i18n.t('Expired');
      case 'error':
        return this.i18n.t('Check failed');
      default:
        return this.i18n.t('Not configured');
    }
  }

  private resolveStatusIcon(status: CertificateHealthWorstStatus): string {
    switch (status) {
      case 'ok':
        return 'verified';
      case 'warning':
        return 'schedule';
      case 'critical':
        return 'priority_high';
      case 'expired':
        return 'dangerous';
      case 'error':
        return 'wifi_tethering_error';
      default:
        return 'shield';
    }
  }
}
