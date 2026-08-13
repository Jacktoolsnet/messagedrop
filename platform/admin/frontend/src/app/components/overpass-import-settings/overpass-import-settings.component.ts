import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink } from '@angular/router';
import { finalize, forkJoin } from 'rxjs';
import { OverpassImportCatalog, OverpassImportSettings } from '../../interfaces/overpass-import.interface';
import { DisplayMessageService } from '../../services/display-message.service';
import { OverpassImportService } from '../../services/overpass-import.service';
import { TranslationHelperService } from '../../services/translation-helper.service';

@Component({
  selector: 'app-overpass-import-settings',
  imports: [RouterLink, MatButtonModule, MatCardModule, MatIconModule, MatProgressBarModule, MatSlideToggleModule, MatToolbarModule],
  templateUrl: './overpass-import-settings.component.html',
  styleUrl: './overpass-import-settings.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OverpassImportSettingsComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly service = inject(OverpassImportService);
  private readonly messages = inject(DisplayMessageService);
  readonly i18n = inject(TranslationHelperService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly catalog = signal<OverpassImportCatalog | null>(null);
  readonly settings = signal<OverpassImportSettings | null>(null);
  readonly enabledCategories = signal<ReadonlySet<string>>(new Set());
  readonly selectedSubcategories = signal<Record<string, string[]>>({});
  readonly selectedCategory = signal<string | null>(null);
  readonly categoryNames = computed(() => Object.keys(this.catalog()?.categories ?? {}));
  readonly visibleSubcategories = computed(() => {
    const category = this.selectedCategory();
    return category ? this.catalog()?.categories[category] ?? [] : [];
  });
  readonly hasChanges = computed(() => {
    const settings = this.settings();
    if (!settings) return false;
    const currentCategories = [...this.enabledCategories()].sort();
    const storedCategories = [...settings.categories].sort();
    if (JSON.stringify(currentCategories) !== JSON.stringify(storedCategories)) return true;
    return currentCategories.some((category) => JSON.stringify([...(this.selectedSubcategories()[category] ?? [])].sort())
      !== JSON.stringify([...this.initialSubcategories(settings, category)].sort()));
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    forkJoin({ settings: this.service.getSettings(), catalog: this.service.getCatalog() })
      .pipe(finalize(() => this.loading.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ settings, catalog }) => {
          this.catalog.set(catalog);
          this.settings.set(settings.settings);
          this.enabledCategories.set(new Set(settings.settings.categories));
          this.selectedSubcategories.set(Object.fromEntries(settings.settings.categories.map((category) => [
            category, this.initialSubcategories(settings.settings, category, catalog)
          ])));
          this.selectedCategory.set(settings.settings.categories[0] ?? Object.keys(catalog.categories)[0] ?? null);
        },
        error: () => this.showError(this.i18n.t('Could not load Overpass settings.'))
      });
  }

  selectCategory(category: string): void {
    this.selectedCategory.set(category);
  }

  isCategoryEnabled(category: string): boolean {
    return this.enabledCategories().has(category);
  }

  toggleCategory(category: string, enabled: boolean): void {
    const next = new Set(this.enabledCategories());
    if (enabled) {
      next.add(category);
      if (!Object.hasOwn(this.selectedSubcategories(), category)) {
        this.selectedSubcategories.update((value) => ({ ...value, [category]: [...(this.catalog()?.categories[category] ?? [])] }));
      }
    } else {
      next.delete(category);
    }
    this.enabledCategories.set(next);
    this.selectedCategory.set(category);
  }

  isSubcategoryEnabled(subcategory: string): boolean {
    const category = this.selectedCategory();
    return !!category && (this.selectedSubcategories()[category] ?? []).includes(subcategory);
  }

  toggleSubcategory(subcategory: string, enabled: boolean): void {
    const category = this.selectedCategory();
    if (!category) return;
    const selected = new Set(this.selectedSubcategories()[category] ?? []);
    if (enabled) selected.add(subcategory); else selected.delete(subcategory);
    this.selectedSubcategories.update((value) => ({ ...value, [category]: [...selected] }));
  }

  enableAllSubcategories(): void {
    const category = this.selectedCategory();
    if (!category) return;
    this.selectedSubcategories.update((value) => ({ ...value, [category]: [...this.visibleSubcategories()] }));
  }

  disableAllSubcategories(): void {
    const category = this.selectedCategory();
    if (!category) return;
    this.selectedSubcategories.update((value) => ({ ...value, [category]: [] }));
  }

  save(): void {
    const settings = this.settings();
    if (!settings || this.saving() || this.enabledCategories().size === 0) return;
    const categories = [...this.enabledCategories()];
    const payload: OverpassImportSettings = { ...settings, categories,
      subcategories: Object.fromEntries(categories.map((category) => [category, this.selectedSubcategories()[category] ?? []])) };
    this.saving.set(true);
    this.service.updateSettings(payload)
      .pipe(finalize(() => this.saving.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.settings.set(response.settings);
          this.messages.open(this.i18n.t('Overpass categories saved.'), undefined, { panelClass: 'snack-success', verticalPosition: 'top' });
        },
        error: () => this.showError(this.i18n.t('Could not save Overpass settings.'))
      });
  }

  label(value: string): string {
    const labels: Record<string, string> = {
      accommodation: 'Accommodation', tourism: 'Tourism', leisure: 'Leisure', food_drink: 'Food & drink', amenities: 'Public amenities',
      hotel: 'Hotels', guest_house: 'Guest houses', hostel: 'Hostels', motel: 'Motels', apartment: 'Holiday apartments', chalet: 'Chalets', resort: 'Resorts',
      camp_site: 'Campsites', caravan_site: 'Caravan sites', alpine_hut: 'Alpine huts', wilderness_hut: 'Wilderness huts',
      attraction: 'Attractions', museum: 'Museums', gallery: 'Galleries', viewpoint: 'Viewpoints', zoo: 'Zoos', aquarium: 'Aquariums',
      theme_park: 'Theme parks', artwork: 'Artworks', picnic_site: 'Picnic sites', information: 'Tourist information', castle: 'Castles',
      monument: 'Monuments', memorial: 'Memorials', ruins: 'Ruins', archaeological_site: 'Archaeological sites', park: 'Parks',
      nature_reserve: 'Nature reserves', playground: 'Playgrounds', fitness_centre: 'Fitness centres', sports_centre: 'Sports centres',
      swimming_pool: 'Swimming pools', water_park: 'Water parks', miniature_golf: 'Miniature golf', golf_course: 'Golf courses',
      marina: 'Marinas', beach_resort: 'Beach resorts', bowling_alley: 'Bowling alleys', restaurant: 'Restaurants', cafe: 'Cafés',
      bar: 'Bars', pub: 'Pubs', fast_food: 'Fast food', biergarten: 'Beer gardens', toilets: 'Public toilets'
    };
    return this.i18n.t(labels[value] ?? value.replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase()));
  }

  private initialSubcategories(settings: OverpassImportSettings, category: string, catalog = this.catalog()): string[] {
    return Object.hasOwn(settings.subcategories ?? {}, category)
      ? [...(settings.subcategories[category] ?? [])]
      : [...(catalog?.categories[category] ?? [])];
  }

  private showError(message: string): void {
    this.messages.open(message, undefined, { panelClass: 'snack-error', verticalPosition: 'top' });
  }
}
