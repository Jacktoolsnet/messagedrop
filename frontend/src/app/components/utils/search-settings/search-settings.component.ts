import { CommonModule } from '@angular/common';
import { Component, computed, inject, ChangeDetectionStrategy, DestroyRef, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { TranslocoPipe } from '@jsverse/transloco';
import { Location } from '../../../interfaces/location';
import {
  DEFAULT_SEARCH_SETTINGS,
  PoiSearchSettingsEntry,
  SearchSettings,
  SearchSettingsKey,
  applyOverpassAvailability,
  normalizePoiSetting
} from '../../../interfaces/search-settings';
import { OVERPASS_SUBCATEGORIES, OverpassAvailability, OverpassCategory } from '../../../interfaces/overpass';
import { HelpDialogService } from '../help-dialog/help-dialog.service';
import { SearchSettingsMapPreviewComponent } from './search-settings-map-preview.component';
import { UserService } from '../../../services/user.service';
import { LanguageService } from '../../../services/language.service';
import { OverpassService } from '../../../services/overpass.service';

const REGION_PREVIEW_LOCATIONS: Record<string, Location> = {
  DE: { latitude: 51.1657, longitude: 10.4515, plusCode: '' },
  AT: { latitude: 47.5162, longitude: 14.5501, plusCode: '' },
  CH: { latitude: 46.8182, longitude: 8.2275, plusCode: '' },
  FR: { latitude: 46.2276, longitude: 2.2137, plusCode: '' },
  BE: { latitude: 50.5039, longitude: 4.4699, plusCode: '' },
  CA: { latitude: 56.1304, longitude: -106.3468, plusCode: '' },
  ES: { latitude: 40.4637, longitude: -3.7492, plusCode: '' },
  MX: { latitude: 23.6345, longitude: -102.5528, plusCode: '' },
  US: { latitude: 39.8283, longitude: -98.5795, plusCode: '' },
  GB: { latitude: 55.3781, longitude: -3.436, plusCode: '' },
  IE: { latitude: 53.1424, longitude: -7.6921, plusCode: '' },
  AU: { latitude: -25.2744, longitude: 133.7751, plusCode: '' },
  NZ: { latitude: -40.9006, longitude: 174.886, plusCode: '' }
};

const LANGUAGE_PREVIEW_LOCATIONS: Record<string, Location> = {
  de: REGION_PREVIEW_LOCATIONS['DE'],
  fr: REGION_PREVIEW_LOCATIONS['FR'],
  es: REGION_PREVIEW_LOCATIONS['ES'],
  en: REGION_PREVIEW_LOCATIONS['US']
};

const SEARCH_SETTING_MARKER_ICONS: Record<SearchSettingsKey, string> = {
  publicMessages: 'assets/markers/message-marker.svg',
  secretDrops: 'assets/markers/secretdrop-marker.svg',
  privateNotes: 'assets/markers/note-marker.svg',
  privateImages: 'assets/markers/image-marker.svg',
  privateDocuments: 'assets/markers/document-marker.svg',
  experiences: 'assets/markers/experience-marker.svg',
  myExperiences: 'assets/markers/my-experience-marker.svg',
  wikipedia: 'assets/markers/wikipedia-marker.svg',
  publicTransportStops: 'assets/markers/transport-marker.svg',
  accommodation: 'assets/markers/empty-marker.svg',
  tourism: 'assets/markers/empty-marker.svg',
  leisure: 'assets/markers/empty-marker.svg',
  food_drink: 'assets/markers/empty-marker.svg',
  amenities: 'assets/markers/empty-marker.svg',
  religion: 'assets/markers/empty-marker.svg'
};

interface SearchSettingsItem {
  key: SearchSettingsKey;
  icon: string;
  titleKey: string;
  poiCategory?: OverpassCategory;
}

interface SearchSettingsDialogData {
  settings?: SearchSettings;
  location: Location;
}

@Component({
  selector: 'app-search-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatButtonModule,
    MatCheckboxModule,
    MatIconModule,
    MatSlideToggleModule,
    MatSliderModule,
    TranslocoPipe,
    SearchSettingsMapPreviewComponent
  ],
  templateUrl: './search-settings.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './search-settings.component.css'
})
export class SearchSettingsComponent {
  private readonly dialogRef = inject(MatDialogRef<SearchSettingsComponent>);
  private readonly dialogData = inject<SearchSettingsDialogData>(MAT_DIALOG_DATA);
  private readonly userService = inject(UserService);
  private readonly languageService = inject(LanguageService);
  private readonly overpassService = inject(OverpassService);
  private readonly destroyRef = inject(DestroyRef);
  readonly help = inject(HelpDialogService);
  readonly overpassAvailability = signal<OverpassAvailability>({});
  readonly overpassAvailabilityLoaded = signal(false);

  readonly previewLocation = this.resolvePreviewLocation();
  private readonly allItems: SearchSettingsItem[] = [
    { key: 'publicMessages', icon: 'public', titleKey: 'common.searchSettings.items.publicMessages' },
    { key: 'secretDrops', icon: 'password', titleKey: 'common.searchSettings.items.secretDrops' },
    { key: 'privateNotes', icon: 'sticky_note_2', titleKey: 'common.searchSettings.items.privateNotes' },
    { key: 'privateImages', icon: 'image', titleKey: 'common.searchSettings.items.privateImages' },
    { key: 'privateDocuments', icon: 'description', titleKey: 'common.searchSettings.items.privateDocuments' },
    { key: 'experiences', icon: 'local_activity', titleKey: 'common.searchSettings.items.experiences' },
    { key: 'myExperiences', icon: 'bookmark_star', titleKey: 'common.searchSettings.items.myExperiences' },
    { key: 'wikipedia', icon: 'menu_book', titleKey: 'common.searchSettings.items.wikipedia' },
    {
      key: 'publicTransportStops',
      icon: 'directions_bus',
      titleKey: 'common.searchSettings.items.publicTransportStops'
    },
    {
      key: 'accommodation', icon: 'hotel', titleKey: 'common.searchSettings.items.accommodation',
      poiCategory: 'accommodation'
    },
    {
      key: 'tourism', icon: 'photo_camera', titleKey: 'common.searchSettings.items.tourism',
      poiCategory: 'tourism'
    },
    {
      key: 'leisure', icon: 'sports_soccer', titleKey: 'common.searchSettings.items.leisure',
      poiCategory: 'leisure'
    },
    {
      key: 'food_drink', icon: 'restaurant', titleKey: 'common.searchSettings.items.foodDrink',
      poiCategory: 'food_drink'
    },
    {
      key: 'amenities', icon: 'account_balance', titleKey: 'common.searchSettings.items.amenities',
      poiCategory: 'amenities'
    },
    {
      key: 'religion', icon: 'church', titleKey: 'common.searchSettings.items.religion',
      poiCategory: 'religion'
    }
  ];
  readonly items = computed(() => {
    this.userService.userSet();
    if (this.userService.hasJwt()) {
      return this.availableItems(this.allItems);
    }
    return this.availableItems(this.allItems.filter((item) =>
      item.key === 'publicMessages'
      || item.key === 'secretDrops'
      || item.key === 'experiences'
      || item.key === 'wikipedia'
      || item.key === 'publicTransportStops'
      || item.poiCategory !== undefined
    ));
  });
  readonly minZoom = 3;
  readonly maxZoom = 19;

  searchSettings: SearchSettings = structuredClone(DEFAULT_SEARCH_SETTINGS);

  constructor() {
    this.dialogRef.disableClose = true;

    if (this.dialogData.settings) {
      this.searchSettings = this.mergeSettings(this.dialogData.settings);
    }
    this.overpassService.getAvailability()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (availability) => {
          this.overpassAvailability.set(availability);
          this.searchSettings = applyOverpassAvailability(this.searchSettings, availability);
          this.overpassAvailabilityLoaded.set(true);
        },
        error: () => {
          this.overpassAvailability.set({});
          this.searchSettings = applyOverpassAvailability(this.searchSettings, {});
          this.overpassAvailabilityLoaded.set(true);
        }
      });
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onApply(): void {
    this.dialogRef.close(this.searchSettings);
  }

  updateEnabled(key: SearchSettingsKey, enabled: boolean): void {
    this.searchSettings = {
      ...this.searchSettings,
      [key]: { ...this.searchSettings[key], enabled }
    };
  }

  updateZoom(key: SearchSettingsKey, zoom: number): void {
    this.searchSettings = {
      ...this.searchSettings,
      [key]: { ...this.searchSettings[key], minZoom: zoom }
    };
  }

  updateSubcategory(category: OverpassCategory, subcategory: string, enabled: boolean): void {
    const setting = this.searchSettings[category] as PoiSearchSettingsEntry;
    this.searchSettings = {
      ...this.searchSettings,
      [category]: {
        ...setting,
        subcategories: { ...setting.subcategories, [subcategory]: enabled }
      }
    };
  }

  getSubcategories(category: OverpassCategory): readonly string[] {
    return this.overpassAvailability()[category] ?? [];
  }

  isSubcategoryEnabled(category: OverpassCategory, subcategory: string): boolean {
    return (this.searchSettings[category] as PoiSearchSettingsEntry).subcategories[subcategory] ?? false;
  }

  getMinZoom(key: SearchSettingsKey): number {
    if (key === 'publicTransportStops') {
      return 16;
    }
    if (key === 'wikipedia' || Object.hasOwn(OVERPASS_SUBCATEGORIES, key)) return 14;
    return this.minZoom;
  }

  getPreviewMarkerIcon(key: SearchSettingsKey): string {
    return SEARCH_SETTING_MARKER_ICONS[key];
  }

  getPreviewMarkers(key: SearchSettingsKey): {
    latitude: number;
    longitude: number;
    iconUrl: string;
    overpassCategory?: OverpassCategory;
  }[] {
    return [{
      latitude: this.previewLocation.latitude,
      longitude: this.previewLocation.longitude,
      iconUrl: this.getPreviewMarkerIcon(key),
      overpassCategory: Object.hasOwn(OVERPASS_SUBCATEGORIES, key) ? key as OverpassCategory : undefined
    }];
  }

  private mergeSettings(settings: SearchSettings): SearchSettings {
    return {
      publicMessages: { ...DEFAULT_SEARCH_SETTINGS.publicMessages, ...settings.publicMessages },
      secretDrops: { ...DEFAULT_SEARCH_SETTINGS.secretDrops, ...settings.secretDrops },
      privateNotes: { ...DEFAULT_SEARCH_SETTINGS.privateNotes, ...settings.privateNotes },
      privateImages: { ...DEFAULT_SEARCH_SETTINGS.privateImages, ...settings.privateImages },
      privateDocuments: { ...DEFAULT_SEARCH_SETTINGS.privateDocuments, ...settings.privateDocuments },
      experiences: { ...DEFAULT_SEARCH_SETTINGS.experiences, ...settings.experiences },
      myExperiences: { ...DEFAULT_SEARCH_SETTINGS.myExperiences, ...settings.myExperiences },
      wikipedia: {
        ...DEFAULT_SEARCH_SETTINGS.wikipedia,
        ...settings.wikipedia,
        minZoom: Math.min(19, Math.max(14, settings.wikipedia?.minZoom ?? DEFAULT_SEARCH_SETTINGS.wikipedia.minZoom))
      },
      publicTransportStops: {
        ...DEFAULT_SEARCH_SETTINGS.publicTransportStops,
        ...settings.publicTransportStops,
        minZoom: Math.min(19, Math.max(
          16,
          settings.publicTransportStops?.minZoom ?? DEFAULT_SEARCH_SETTINGS.publicTransportStops.minZoom
        ))
      },
      accommodation: normalizePoiSetting('accommodation', settings.accommodation),
      tourism: normalizePoiSetting('tourism', settings.tourism),
      leisure: normalizePoiSetting('leisure', settings.leisure),
      food_drink: normalizePoiSetting('food_drink', settings.food_drink),
      amenities: normalizePoiSetting('amenities', settings.amenities),
      religion: normalizePoiSetting('religion', settings.religion)
    };
  }

  private availableItems(items: SearchSettingsItem[]): SearchSettingsItem[] {
    const availability = this.overpassAvailability();
    return items.filter((item) => !item.poiCategory || (availability[item.poiCategory]?.length ?? 0) > 0);
  }

  private resolvePreviewLocation(): Location {
    const browserLocale = this.getBrowserLocale();
    const normalizedLocale = browserLocale.replace('_', '-').trim();
    const parts = normalizedLocale.split('-').filter(Boolean);
    const language = parts[0]?.toLowerCase();
    const region = parts
      .slice(1)
      .find((part) => /^[a-z]{2}$/i.test(part) || /^\d{3}$/.test(part))
      ?.toUpperCase();

    if (region && REGION_PREVIEW_LOCATIONS[region]) {
      return REGION_PREVIEW_LOCATIONS[region];
    }

    if (language && LANGUAGE_PREVIEW_LOCATIONS[language]) {
      return LANGUAGE_PREVIEW_LOCATIONS[language];
    }

    return this.dialogData.location;
  }

  private getBrowserLocale(): string {
    if (typeof navigator !== 'undefined') {
      const candidate = navigator.languages?.[0] || navigator.language;
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
    }

    return this.languageService.effectiveLanguage();
  }
}
