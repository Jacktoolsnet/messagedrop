import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { TranslocoPipe } from '@jsverse/transloco';
import { Location } from '../../../interfaces/location';
import { DEFAULT_SEARCH_SETTINGS, SearchSettings, SearchSettingsKey } from '../../../interfaces/search-settings';
import { HelpDialogService } from '../help-dialog/help-dialog.service';
import { SearchSettingsMapPreviewComponent } from './search-settings-map-preview.component';
import { UserService } from '../../../services/user.service';
import { LanguageService } from '../../../services/language.service';

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
  privateNotes: 'assets/markers/note-marker.svg',
  privateImages: 'assets/markers/image-marker.svg',
  privateDocuments: 'assets/markers/document-marker.svg',
  experiences: 'assets/markers/experience-marker.svg',
  myExperiences: 'assets/markers/my-experience-marker.svg'
};

interface SearchSettingsItem {
  key: SearchSettingsKey;
  icon: string;
  titleKey: string;
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
    MatDialogClose,
    MatButtonModule,
    MatIconModule,
    MatSlideToggleModule,
    MatSliderModule,
    TranslocoPipe,
    SearchSettingsMapPreviewComponent
  ],
  templateUrl: './search-settings.component.html',
  styleUrl: './search-settings.component.css'
})
export class SearchSettingsComponent {
  private readonly dialogRef = inject(MatDialogRef<SearchSettingsComponent>);
  private readonly dialogData = inject<SearchSettingsDialogData>(MAT_DIALOG_DATA);
  private readonly userService = inject(UserService);
  private readonly languageService = inject(LanguageService);
  readonly help = inject(HelpDialogService);

  readonly previewLocation = this.resolvePreviewLocation();
  private readonly allItems: SearchSettingsItem[] = [
    { key: 'publicMessages', icon: 'public', titleKey: 'common.searchSettings.items.publicMessages' },
    { key: 'privateNotes', icon: 'sticky_note_2', titleKey: 'common.searchSettings.items.privateNotes' },
    { key: 'privateImages', icon: 'image', titleKey: 'common.searchSettings.items.privateImages' },
    { key: 'privateDocuments', icon: 'description', titleKey: 'common.searchSettings.items.privateDocuments' },
    { key: 'experiences', icon: 'local_activity', titleKey: 'common.searchSettings.items.experiences' },
    { key: 'myExperiences', icon: 'bookmark_star', titleKey: 'common.searchSettings.items.myExperiences' }
  ];
  readonly items = computed(() => {
    this.userService.userSet();
    if (this.userService.hasJwt()) {
      return this.allItems;
    }
    return this.allItems.filter((item) => item.key === 'publicMessages' || item.key === 'experiences');
  });
  readonly minZoom = 3;
  readonly maxZoom = 19;

  searchSettings: SearchSettings = structuredClone(DEFAULT_SEARCH_SETTINGS);

  constructor() {
    if (this.dialogData.settings) {
      this.searchSettings = this.mergeSettings(this.dialogData.settings);
    }
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

  getPreviewMarkerIcon(key: SearchSettingsKey): string {
    return SEARCH_SETTING_MARKER_ICONS[key];
  }

  getPreviewMarkers(key: SearchSettingsKey): Array<{ latitude: number; longitude: number; iconUrl: string }> {
    return [{
      latitude: this.previewLocation.latitude,
      longitude: this.previewLocation.longitude,
      iconUrl: this.getPreviewMarkerIcon(key)
    }];
  }

  private mergeSettings(settings: SearchSettings): SearchSettings {
    return {
      publicMessages: { ...DEFAULT_SEARCH_SETTINGS.publicMessages, ...settings.publicMessages },
      privateNotes: { ...DEFAULT_SEARCH_SETTINGS.privateNotes, ...settings.privateNotes },
      privateImages: { ...DEFAULT_SEARCH_SETTINGS.privateImages, ...settings.privateImages },
      privateDocuments: { ...DEFAULT_SEARCH_SETTINGS.privateDocuments, ...settings.privateDocuments },
      experiences: { ...DEFAULT_SEARCH_SETTINGS.experiences, ...settings.experiences },
      myExperiences: { ...DEFAULT_SEARCH_SETTINGS.myExperiences, ...settings.myExperiences }
    };
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
