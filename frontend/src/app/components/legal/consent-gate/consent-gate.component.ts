
import { Component, Input, OnDestroy, OnInit, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { TranslocoPipe } from '@jsverse/transloco';
import { Observable, Subscription } from 'rxjs';
import { ConsentKey } from '../../../interfaces/consent-settings.interface';
import { AppService } from '../../../services/app.service';
import { DisclaimerComponent } from '../disclaimer/disclaimer.component';
import { ExternalContentComponent } from '../external-content/external-content.component';
import { PrivacyPolicyComponent } from '../privacy-policy/privacy-policy.component';
import { TermsOfServiceComponent } from '../terms-of-service/terms-of-service.component';


@Component({
  selector: 'app-consent-gate',
  standalone: true,
  imports: [
    MatIconModule,
    MatButtonModule,
    MatChipsModule,
    MatSlideToggleModule,
    TranslocoPipe
],
  templateUrl: './consent-gate.component.html',
  styleUrl: './consent-gate.component.css'
})
export class ConsentGateComponent implements OnInit, OnDestroy {
  /** Optional: erfordert nur diese Keys; wenn leer, werden alle vorhandenen in consentSettings genutzt */
  @Input() requiredKeys?: ConsentKey[];

  missing: ConsentKey[] = [];
  show = false;

  public appService = inject(AppService);
  private dialog = inject(MatDialog);
  private sub?: Subscription;

  ngOnInit(): void {
    this.computeMissing();

    // Falls AppService ein settings$ Observable anbietet, darauf hören (duck-typing)
    const settings$ = (this.appService as { settings$?: Observable<unknown> }).settings$;
    if (settings$?.subscribe) {
      this.sub = settings$.subscribe(() => this.computeMissing());
    }
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  private computeMissing(): void {
    const s = this.appService.getAppSettings();
    const consents: Partial<Record<ConsentKey, boolean>> = s.consentSettings ?? {};
    const keys: ConsentKey[] = this.requiredKeys?.length
      ? this.requiredKeys
      : (Object.keys(consents) as ConsentKey[]);

    const versionMismatch = s.acceptedLegalVersion !== this.appService.getLegalVersion();

    this.missing = keys.filter(k => !consents[k]);
    this.show = this.missing.length > 0 || versionMismatch;
  }

  displayName(k: ConsentKey): string {
    // Mapping für hübsche Namen; Unbekannte werden „Titlecased“.
    const map: Record<string, string> = {
      disclaimer: 'Disclaimer',
      privacyPolicy: 'Privacy Policy',
      termsOfService: 'Terms of Service',
      ageConfirmed: 'I confirm I am at least 16 years old'
    };
    if (map[k]) return map[k];
    return k.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()).trim();
  }

  review(key: ConsentKey): void {
    if (key === 'privacyPolicy') {
      this.dialog.open(PrivacyPolicyComponent, {
        closeOnNavigation: true,
        autoFocus: false,
        maxHeight: '90vh',
        width: '800px',
        maxWidth: '90vw',
        hasBackdrop: true,
        backdropClass: 'dialog-backdrop-transparent',
        disableClose: true,
      }).afterClosed().subscribe(() => this.computeMissing());
      return;
    }
    if (key === 'termsOfService') {
      this.dialog.open(TermsOfServiceComponent, {
        closeOnNavigation: true,
        autoFocus: false,
        maxHeight: '90vh',
        width: '800px',
        maxWidth: '90vw',
        hasBackdrop: true,
        backdropClass: 'dialog-backdrop-transparent',
        disableClose: true,
      }).afterClosed().subscribe(() => this.computeMissing());
      return;
    }
    if (key === 'disclaimer') {
      this.dialog.open(DisclaimerComponent, {
        closeOnNavigation: true,
        autoFocus: false,
        maxHeight: '90vh',
        width: '800px',
        maxWidth: '90vw',
        hasBackdrop: true,
        backdropClass: 'dialog-backdrop-transparent',
        disableClose: true,
      }).afterClosed().subscribe(() => this.computeMissing());
      return;
    }
    if (key === 'ageConfirmed') {
      this.toggleAgeConfirmed(true);
      return;
    }
  }

  toggleAgeConfirmed(val: boolean): void {
    const current = this.appService.getAppSettings();
    current.consentSettings.ageConfirmed = val;
    this.appService.setAppSettings(current);
    this.computeMissing();
  }

  toggleDiagnosticLogging(enabled: boolean): void {
    const current = this.appService.getAppSettings();
    this.appService.setAppSettings({ ...current, diagnosticLogging: enabled });
  }

  toggleBackupOnExit(enabled: boolean): void {
    const current = this.appService.getAppSettings();
    this.appService.setAppSettings({ ...current, backupOnExit: enabled });
  }

  get isAgeConfirmed(): boolean {
    return this.appService.getAppSettings().consentSettings.ageConfirmed === true;
  }

  public editExternalContentSettings() {
    const dialogRef = this.dialog.open(ExternalContentComponent, {
      data: { appSettings: this.appService.getAppSettings() },
      closeOnNavigation: true,
      maxHeight: '90vh',
      width: '800px',
      maxWidth: '90vw',
      autoFocus: false,
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop-transparent',
      disableClose: true,
    });

    dialogRef.afterClosed().subscribe(() => this.computeMissing());
  }
}
