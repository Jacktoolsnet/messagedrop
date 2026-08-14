import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { OVERPASS_CATEGORY_ICONS, OverpassCategory, OverpassPoi } from '../../interfaces/overpass';
import { DialogHeaderComponent } from '../utils/dialog-header/dialog-header.component';
import { HelpDialogService } from '../utils/help-dialog/help-dialog.service';

export type OverpassPoiListAction = 'show_on_map' | 'calculate_route';

export interface OverpassPoiListResult {
  action: OverpassPoiListAction;
  poi: OverpassPoi;
}

interface OpeningHoursRow {
  days: string;
  periods: string[];
  closed: boolean;
}

@Component({
  selector: 'app-overpass-poi-list',
  standalone: true,
  imports: [
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatTooltipModule,
    TranslocoPipe,
    DialogHeaderComponent
  ],
  templateUrl: './overpass-poi-list.component.html',
  styleUrl: './overpass-poi-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OverpassPoiListComponent {
  readonly data = inject<{ pois: OverpassPoi[] }>(MAT_DIALOG_DATA);
  readonly help = inject(HelpDialogService);
  private readonly transloco = inject(TranslocoService);
  private readonly dialogRef = inject(MatDialogRef<OverpassPoiListComponent, OverpassPoiListResult>);
  private readonly failedImages = signal<ReadonlySet<string>>(new Set());

  categoryIcon(category: OverpassCategory): string {
    return OVERPASS_CATEGORY_ICONS[category];
  }

  address(poi: OverpassPoi): string {
    return [
      [poi.address.street, poi.address.houseNumber].filter(Boolean).join(' '),
      [poi.address.postcode, poi.address.city].filter(Boolean).join(' '),
      poi.address.country
    ].filter(Boolean).join(', ');
  }

  metadataImage(poi: OverpassPoi): string | null {
    if (this.failedImages().has(poi.id)) return null;
    const value = poi.websiteMetadata?.image;
    if (!value) return null;
    try {
      const url = new URL(value);
      return url.protocol === 'https:' ? url.toString() : null;
    } catch {
      return null;
    }
  }

  description(poi: OverpassPoi): string | null {
    return this.localizedOsmText(poi.properties.descriptions, poi.properties.description)
      || poi.websiteMetadata?.description?.trim()
      || null;
  }

  inscription(poi: OverpassPoi): string | null {
    const value = this.localizedOsmText(poi.properties.inscriptions, poi.properties.inscription);
    if (!value || value === this.description(poi)) return null;
    return value.replace(/\s*\|\s*/gu, '\n');
  }

  website(poi: OverpassPoi): string | null {
    const value = poi.contact.website;
    if (!value) return null;
    try {
      const url = new URL(value);
      return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
    } catch {
      return null;
    }
  }

  openingHoursRows(poi: OverpassPoi): OpeningHoursRow[] {
    const value = poi.properties.openingHours?.trim();
    if (!value) return [];
    const language = this.transloco.getActiveLang() || 'en';
    return value.split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
      if (part === '24/7') {
        return {
          days: '',
          periods: [this.transloco.translate('common.overpass.open24Hours')],
          closed: false
        };
      }
      const match = part.match(/^(.+?)\s+(off|closed|24\/7|\d{1,2}:\d{2}-.+)$/iu);
      if (!match) return { days: '', periods: [part], closed: false };
      const days = formatDaySelector(match[1], language, (key) => this.transloco.translate(key));
      if (!days) return { days: '', periods: [part], closed: false };
      const hours = match[2].trim();
      if (/^(?:off|closed)$/iu.test(hours)) return { days, periods: [], closed: true };
      if (hours === '24/7') {
        return { days, periods: [this.transloco.translate('common.overpass.open24Hours')], closed: false };
      }
      const periods = hours.split(',').map((period) => period.trim())
        .filter((period) => /^\d{1,2}:\d{2}-\d{1,2}:\d{2}$/u.test(period))
        .map((period) => period.replace('-', '–'));
      return periods.length ? { days, periods, closed: false } : { days: '', periods: [part], closed: false };
    });
  }

  hasAdditionalDetails(poi: OverpassPoi): boolean {
    return Boolean(
      this.address(poi)
      || poi.websiteMetadata?.siteName
      || poi.properties.stars
      || poi.properties.rooms
      || poi.properties.beds
      || poi.properties.wheelchair
      || poi.contact.phone
      || poi.contact.email
      || this.website(poi)
    );
  }

  wheelchairIcon(value: string): string {
    if (value === 'yes' || value === 'designated') return 'check_circle';
    if (value === 'limited') return 'warning';
    if (value === 'no') return 'cancel';
    return 'help';
  }

  wheelchairLabelKey(value: string): string {
    if (value === 'yes' || value === 'designated') return 'common.overpass.wheelchairYes';
    if (value === 'limited') return 'common.overpass.wheelchairLimited';
    if (value === 'no') return 'common.overpass.wheelchairNo';
    return 'common.overpass.wheelchairUnknown';
  }

  wheelchairStatusClass(value: string): string {
    if (value === 'yes' || value === 'designated') return 'accessibility-status status-positive';
    if (value === 'limited') return 'accessibility-status status-warning';
    if (value === 'no') return 'accessibility-status status-negative';
    return 'accessibility-status status-unknown';
  }

  imageFailed(poi: OverpassPoi): void {
    this.failedImages.update((current) => new Set([...current, poi.id]));
  }

  private localizedOsmText(
    translations: Partial<Record<'de' | 'en' | 'es' | 'fr', string>> | undefined,
    fallback: string | undefined
  ): string | null {
    const activeLanguage = (this.transloco.getActiveLang() || 'en').split('-')[0] as 'de' | 'en' | 'es' | 'fr';
    return translations?.[activeLanguage]?.trim()
      || fallback?.trim()
      || translations?.de?.trim()
      || translations?.en?.trim()
      || translations?.es?.trim()
      || translations?.fr?.trim()
      || null;
  }

  headerBackground(poi: OverpassPoi): string {
    const image = this.metadataImage(poi);
    return image ? `url("${image.replaceAll('"', '%22')}")` : 'none';
  }

  showOnMap(poi: OverpassPoi): void {
    this.dialogRef.close({ action: 'show_on_map', poi });
  }

  calculateRoute(poi: OverpassPoi): void {
    this.dialogRef.close({ action: 'calculate_route', poi });
  }

  openInMaps(poi: OverpassPoi): void {
    const query = encodeURIComponent(`${poi.latitude},${poi.longitude}`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank', 'noopener,noreferrer');
  }

  webSearch(poi: OverpassPoi): void {
    const query = [poi.name, this.address(poi)].filter(Boolean).join(' ');
    if (!query) return;
    window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank', 'noopener,noreferrer');
  }
}

const OSM_WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] as const;

function formatDaySelector(selector: string, language: string, translate: (key: string) => string): string | null {
  const compact = selector.replaceAll(' ', '');
  const parts = compact.split(',');
  const labels: string[] = [];
  for (const part of parts) {
    if (part === 'PH') {
      labels.push(translate('common.overpass.publicHolidays'));
      continue;
    }
    if (part === 'SH') {
      labels.push(translate('common.overpass.schoolHolidays'));
      continue;
    }
    const [start, end, ...rest] = part.split('-');
    if (rest.length || !isOsmWeekday(start) || (end && !isOsmWeekday(end))) return null;
    const startLabel = localizedWeekday(start, language);
    labels.push(isOsmWeekday(end) ? `${startLabel}–${localizedWeekday(end, language)}` : startLabel);
  }
  return labels.join(', ');
}

function isOsmWeekday(value: string | undefined): value is typeof OSM_WEEKDAYS[number] {
  return !!value && (OSM_WEEKDAYS as readonly string[]).includes(value);
}

function localizedWeekday(value: typeof OSM_WEEKDAYS[number], language: string): string {
  const index = OSM_WEEKDAYS.indexOf(value);
  return new Intl.DateTimeFormat(language, { weekday: 'short', timeZone: 'UTC' })
    .format(new Date(Date.UTC(2024, 0, 1 + index)))
    .replace(/\.$/u, '');
}
