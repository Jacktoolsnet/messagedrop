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


@Component({
  selector: 'app-consent-gate',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatChipsModule],
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
    };
    if (map[k]) return map[k];
    return k.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()).trim();
  }

  review(key: ConsentKey): void {
    if (key === 'disclaimer') {
      this.dialog.open(DisclaimerComponent, {
        closeOnNavigation: true,
        autoFocus: false,
        disableClose: false,
        maxHeight: '90vh',
        maxWidth: '90vw',
        hasBackdrop: true
      }).afterClosed().subscribe(() => this.computeMissing());
      return;
    }
    /* if (key === 'privacyPolicy') {
      // Bis eine eigene Privacy-Consent-Komponente existiert:
      window.open('/privacy', '_blank', 'noopener');
      // Nach Rückkehr kann Nutzer "Accept all" drücken; alternativ später Privacy-Dialog bauen.
      return;
    }*/
    // Weitere Consents (z. B. openStreetMap) könnten hier eigene Dialoge öffnen
  }
}