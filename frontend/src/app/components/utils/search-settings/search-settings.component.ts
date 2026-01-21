import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
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
  readonly help = inject(HelpDialogService);

  readonly location = this.dialogData.location;
  readonly items: SearchSettingsItem[] = [
    { key: 'publicMessages', icon: 'public', titleKey: 'common.searchSettings.items.publicMessages' },
    { key: 'privateNotes', icon: 'sticky_note_2', titleKey: 'common.searchSettings.items.privateNotes' },
    { key: 'privateImages', icon: 'image', titleKey: 'common.searchSettings.items.privateImages' },
    { key: 'privateDocuments', icon: 'description', titleKey: 'common.searchSettings.items.privateDocuments' }
  ];
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

  private mergeSettings(settings: SearchSettings): SearchSettings {
    return {
      publicMessages: { ...DEFAULT_SEARCH_SETTINGS.publicMessages, ...settings.publicMessages },
      privateNotes: { ...DEFAULT_SEARCH_SETTINGS.privateNotes, ...settings.privateNotes },
      privateImages: { ...DEFAULT_SEARCH_SETTINGS.privateImages, ...settings.privateImages },
      privateDocuments: { ...DEFAULT_SEARCH_SETTINGS.privateDocuments, ...settings.privateDocuments }
    };
  }
}
