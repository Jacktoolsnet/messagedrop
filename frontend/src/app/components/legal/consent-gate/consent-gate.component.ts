import { CommonModule } from '@angular/common';
import { Component, Input, OnDestroy, OnInit, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { Subscription } from 'rxjs';
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
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatChipsModule
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
    const settings$ = (this.appService as any).settings$;
    if (settings$?.subscribe) {
      this.sub = settings$.subscribe(() => this.computeMissing());
    }
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  private computeMissing(): void {
    const s = this.appService.getAppSettings();
    const consents = s.consentSettings ?? {};
    const keys: ConsentKey[] = this.requiredKeys?.length
      ? this.requiredKeys
      : (Object.keys(consents) as ConsentKey[]);

    this.missing = keys.filter(k => !Boolean((consents as any)[k]));
    this.show = this.missing.length > 0;
  }

  displayName(k: ConsentKey): string {
    // Mapping für hübsche Namen; Unbekannte werden „Titlecased“.
    const map: Record<string, string> = {
      disclaimer: 'Disclaimer',
      privacyPolicy: 'Privacy Policy',
      termsOfService: 'Terms of Service'
    };
    if (map[k]) return map[k];
    return k.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()).trim();
  }

  review(key: ConsentKey): void {
    if (key === 'privacyPolicy') {
      this.dialog.open(PrivacyPolicyComponent, {
        closeOnNavigation: true,
        autoFocus: false,
        disableClose: false,
        maxHeight: '90vh',
        width: '800px',
        maxWidth: '90vw',
        hasBackdrop: true
      }).afterClosed().subscribe(() => this.computeMissing());
      return;
    }
    if (key === 'termsOfService') {
      this.dialog.open(TermsOfServiceComponent, {
        closeOnNavigation: true,
        autoFocus: false,
        disableClose: false,
        maxHeight: '90vh',
        width: '800px',
        maxWidth: '90vw',
        hasBackdrop: true
      }).afterClosed().subscribe(() => this.computeMissing());
      return;
    }
    if (key === 'disclaimer') {
      this.dialog.open(DisclaimerComponent, {
        closeOnNavigation: true,
        autoFocus: false,
        disableClose: false,
        maxHeight: '90vh',
        width: '800px',
        maxWidth: '90vw',
        hasBackdrop: true
      }).afterClosed().subscribe(() => this.computeMissing());
      return;
    }
  }

  public editExternalContentSettings() {
    const dialogRef = this.dialog.open(ExternalContentComponent, {
      data: { appSettings: this.appService.getAppSettings() },
      closeOnNavigation: true,
      maxHeight: '90vh',
      width: '800px',
      maxWidth: '90vw',
      autoFocus: false,
      hasBackdrop: true
    });

    dialogRef.afterOpened().subscribe(e => { });

    dialogRef.afterClosed().subscribe(() => { });
  }
}