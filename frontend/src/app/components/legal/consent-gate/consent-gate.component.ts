
import { Component, Input, OnDestroy, OnInit, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { TranslocoPipe } from '@jsverse/transloco';
import { Observable, Subscription } from 'rxjs';
import { ConsentKey, ConsentSettings, LegalConsentKey } from '../../../interfaces/consent-settings.interface';
import { AppService } from '../../../services/app.service';
import { UsageProtectionComponent } from '../../app-settings/usage-protection/usage-protection.component';
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
  private readonly legalConsentKeys: LegalConsentKey[] = ['disclaimer', 'privacyPolicy', 'termsOfService'];

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
    const consents = s.consentSettings ?? this.getDefaultConsentSettings();
    const keys: ConsentKey[] = this.requiredKeys?.length
      ? this.requiredKeys
      : [...this.legalConsentKeys, 'ageConsent'];

    const versionMismatch = s.acceptedLegalVersion !== this.appService.getLegalVersion();

    this.missing = keys.filter((k) => {
      if (k === 'ageConsent') {
        return !this.hasAgeConsent(consents);
      }
      return consents[k] !== true;
    });
    this.show = this.missing.length > 0 || versionMismatch;
  }

  displayName(k: ConsentKey): string {
    // Mapping für hübsche Namen; Unbekannte werden „Titlecased“.
    const map: Record<string, string> = {
      disclaimer: 'Disclaimer',
      privacyPolicy: 'Privacy Policy',
      termsOfService: 'Terms of Service',
      ageConsent: 'Age and parental consent'
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
        backdropClass: 'dialog-backdrop',
        disableClose: false,
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
        backdropClass: 'dialog-backdrop',
        disableClose: false,
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
        backdropClass: 'dialog-backdrop',
        disableClose: false,
      }).afterClosed().subscribe(() => this.computeMissing());
      return;
    }
    if (key === 'ageConsent') {
      return;
    }
  }

  setAgeConsentSelection(selection: 'adult' | 'minor' | null | undefined): void {
    if (selection !== 'adult' && selection !== 'minor') {
      return;
    }
    const current = this.appService.getAppSettings();
    void this.appService.setAppSettings({
      ...current,
      consentSettings: {
        ...current.consentSettings,
        ageAdultConfirmed: selection === 'adult',
        ageMinorWithParentalConsentConfirmed: selection === 'minor'
      }
    });
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

  get ageConsentSelection(): 'adult' | 'minor' | null {
    const consent = this.appService.getAppSettings().consentSettings;
    if (consent.ageAdultConfirmed) {
      return 'adult';
    }
    if (consent.ageMinorWithParentalConsentConfirmed) {
      return 'minor';
    }
    return null;
  }

  toggleAgeConsent(selection: 'adult' | 'minor', enabled: boolean): void {
    if (enabled) {
      this.setAgeConsentSelection(selection);
      return;
    }
    const current = this.appService.getAppSettings();
    void this.appService.setAppSettings({
      ...current,
      consentSettings: {
        ...current.consentSettings,
        ageAdultConfirmed: false,
        ageMinorWithParentalConsentConfirmed: false
      }
    });
    this.computeMissing();
  }

  private hasAgeConsent(consent: ConsentSettings): boolean {
    return consent.ageAdultConfirmed === true || consent.ageMinorWithParentalConsentConfirmed === true;
  }

  private getDefaultConsentSettings(): ConsentSettings {
    return {
      disclaimer: false,
      privacyPolicy: false,
      termsOfService: false,
      ageAdultConfirmed: false,
      ageMinorWithParentalConsentConfirmed: false
    };
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
      backdropClass: 'dialog-backdrop',
      disableClose: false,
    });

    dialogRef.afterClosed().subscribe(() => this.computeMissing());
  }

  public editUsageProtectionSettings() {
    const dialogRef = this.dialog.open(UsageProtectionComponent, {
      data: { appSettings: this.appService.getAppSettings() },
      closeOnNavigation: true,
      maxHeight: '90vh',
      width: '800px',
      maxWidth: '90vw',
      autoFocus: false,
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
    });

    dialogRef.afterClosed().subscribe(() => this.computeMissing());
  }
}
