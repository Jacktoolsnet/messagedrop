
import { ChangeDetectionStrategy, Component, EventEmitter, HostListener, inject, Input, OnInit, Output } from '@angular/core';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppSettings } from '../../../interfaces/app-settings';
import { AppService } from '../../../services/app.service';

@Component({
  selector: 'app-enable-location',
  standalone: true,
  imports: [MatSlideToggleModule, MatIconModule, TranslocoPipe],
  templateUrl: './enable-location.component.html',
  styleUrl: './enable-location.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EnableLocationComponent implements OnInit {
  /** Optional: überschreibt den initialen Checked-Status rein visuell */
  @Input() checkedOverride?: boolean;

  /** Optional: persist settings when toggled (default true) */
  @Input() persistOnToggle = true;

  /** Optional: Privacy-Policy URL (default: '/privacy') */
  @Input() privacyUrl = '/privacy';

  /** Emits when toggled */
  @Output() enabledChange = new EventEmitter<boolean>();

  enabled = false;

  private app = inject(AppService);

  ngOnInit(): void {
    const s = this.app.getAppSettings();
    const current = !!s.detectLocationOnStart;
    this.enabled = this.checkedOverride ?? current;
  }

  onToggle(enabled: boolean): void {
    this.enabled = enabled;

    if (this.persistOnToggle) {
      const current = this.app.getAppSettings();
      const updated: AppSettings = { ...current, detectLocationOnStart: enabled };
      this.app.setAppSettings(updated);
    }

    this.enabledChange.emit(enabled);
  }

  // Verhindert, dass Eltern-Container (z. B. Message-Karte/Dialog) Klicks abfangen
  @HostListener('click', ['$event']) onClick(e: Event) { e.stopPropagation(); }
  @HostListener('mousedown', ['$event']) onMouseDown(e: Event) { e.stopPropagation(); }
  @HostListener('pointerdown', ['$event']) onPointerDown(e: Event) { e.stopPropagation(); }
  @HostListener('touchstart', ['$event']) onTouchStart(e: Event) { e.stopPropagation(); }
}
