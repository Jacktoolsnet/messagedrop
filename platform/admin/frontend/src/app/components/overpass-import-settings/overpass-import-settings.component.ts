import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTabsModule } from '@angular/material/tabs';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink } from '@angular/router';
import { catchError, EMPTY, finalize, forkJoin, switchMap, timer } from 'rxjs';
import {
  OverpassDatabaseInfo,
  OverpassImportCatalog,
  OverpassImportJob,
  OverpassMetadataJob,
  OverpassImportSettings
} from '../../interfaces/overpass-import.interface';
import { DisplayMessageService } from '../../services/display-message.service';
import { OverpassImportService } from '../../services/overpass-import.service';
import { TranslationHelperService } from '../../services/translation-helper.service';

@Component({
  selector: 'app-overpass-import-settings',
  imports: [DatePipe, DecimalPipe, RouterLink, MatButtonModule, MatCardModule, MatFormFieldModule, MatIconModule, MatInputModule,
    MatProgressBarModule, MatSelectModule, MatSlideToggleModule, MatTabsModule, MatToolbarModule],
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
  readonly importing = signal(false);
  readonly loadingDatabaseInfo = signal(false);
  readonly catalog = signal<OverpassImportCatalog | null>(null);
  readonly settings = signal<OverpassImportSettings | null>(null);
  readonly databaseInfo = signal<OverpassDatabaseInfo | null>(null);
  readonly enabledCategories = signal<ReadonlySet<string>>(new Set());
  readonly enabledDatasets = signal<ReadonlySet<string>>(new Set());
  readonly selectedSubcategories = signal<Record<string, string[]>>({});
  readonly selectedCategory = signal<string | null>(null);
  readonly selectedContinent = signal('EU');
  readonly selectedCountry = signal<string | null>('DE');
  readonly importsEnabled = signal(false);
  readonly scheduleType = signal<'daily' | 'weekly'>('weekly');
  readonly weekday = signal(0);
  readonly hour = signal(3);
  readonly minute = signal(0);
  readonly timezone = signal('Europe/Berlin');
  readonly refreshSource = signal(true);
  readonly weekdays = [
    { value: 0, label: 'Sunday' }, { value: 1, label: 'Monday' }, { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' }, { value: 4, label: 'Thursday' }, { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' }
  ];
  readonly timezones = ['Europe/Berlin', 'Europe/Stockholm', 'Europe/Copenhagen', 'UTC'];
  readonly categoryNames = computed(() => Object.keys(this.catalog()?.categories ?? {}));
  readonly visibleSubcategories = computed(() => {
    const category = this.selectedCategory();
    return category ? this.catalog()?.categories[category] ?? [] : [];
  });
  readonly countryGroups = computed(() => {
    const groups = new Map<string, OverpassImportCatalog['datasets']>();
    for (const dataset of (this.catalog()?.datasets ?? [])
      .filter((row) => row.continentCode === this.selectedContinent() && row.level === 'country')) {
      const rows = groups.get(dataset.countryCode) ?? [];
      rows.push(dataset);
      groups.set(dataset.countryCode, rows);
    }
    return [...groups.entries()].map(([countryCode, datasets]) => ({ countryCode, datasets }));
  });
  readonly continents = computed(() => [...new Map((this.catalog()?.datasets ?? [])
    .map((dataset) => [dataset.continentCode, dataset.continentLabel])).entries()]
    .map(([code, label]) => ({ code, label })));
  readonly hasChanges = computed(() => {
    const settings = this.settings();
    if (!settings) return false;
    return JSON.stringify(this.comparable(this.buildPayload(settings))) !== JSON.stringify(this.comparable(settings));
  });

  constructor() {
    this.load();
    timer(5000, 5000).pipe(
      switchMap(() => this.service.getJobs().pipe(catchError(() => EMPTY))),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((value) => {
      const metadataWasRunning = this.hasActiveMetadataJob();
      this.databaseInfo.update((current) => current ? {
        ...current,
        jobs: value.jobs,
        metadataJobs: value.metadataJobs
      } : current);
      if (metadataWasRunning && !this.hasActiveMetadataJob()) this.loadDatabaseInfo();
    });
    // The POI metadata total is an aggregate over the active datasets and therefore
    // deliberately refreshed less often than the lightweight job progress.
    timer(60000, 60000).pipe(
      switchMap(() => this.hasActiveMetadataJob() && !this.loadingDatabaseInfo()
        ? this.service.getDatabaseInfo().pipe(catchError(() => EMPTY))
        : EMPTY),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((value) => this.databaseInfo.set(value));
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
          const availableDatasets = new Set(catalog.datasets.map((dataset) => dataset.id));
          this.enabledDatasets.set(new Set(settings.settings.datasets.filter((dataset) => availableDatasets.has(dataset))));
          this.importsEnabled.set(settings.settings.enabled);
          this.scheduleType.set(settings.settings.scheduleType);
          this.weekday.set(settings.settings.weekday);
          this.hour.set(settings.settings.hour);
          this.minute.set(settings.settings.minute);
          this.timezone.set(settings.settings.timezone);
          this.refreshSource.set(settings.settings.refreshSource);
          this.selectedSubcategories.set(Object.fromEntries(settings.settings.categories.map((category) => [
            category, this.initialSubcategories(settings.settings, category, catalog)
          ])));
          this.selectedCategory.set(settings.settings.categories[0] ?? Object.keys(catalog.categories)[0] ?? null);
          this.loadDatabaseInfo();
        },
        error: () => this.showError(this.i18n.t('Could not load Overpass settings.'))
      });
  }

  isDatasetEnabled(datasetId: string): boolean {
    return this.enabledDatasets().has(datasetId);
  }

  countryLabel(countryCode: string): string {
    try {
      return new Intl.DisplayNames([this.i18n.lang() || 'de'], { type: 'region' }).of(countryCode) || countryCode;
    } catch { return countryCode; }
  }

  selectContinent(continentCode: string): void {
    this.selectedContinent.set(continentCode);
    const firstCountry = this.countryGroups()[0]?.countryCode ?? null;
    this.selectedCountry.set(firstCountry);
  }

  selectCountry(countryCode: string): void {
    this.selectedCountry.set(countryCode);
  }

  countryDataset(datasets: OverpassImportCatalog['datasets']): OverpassImportCatalog['datasets'][number] | null {
    return datasets.find((dataset) => dataset.level === 'country') ?? null;
  }

  toggleCountry(datasets: OverpassImportCatalog['datasets'], enabled: boolean): void {
    const country = this.countryDataset(datasets);
    if (!country) return;
    const next = new Set(this.enabledDatasets());
    for (const dataset of datasets) next.delete(dataset.id);
    if (enabled) next.add(country.id);
    this.enabledDatasets.set(next);
  }

  setHour(value: string): void {
    this.hour.set(Math.max(0, Math.min(23, Number(value) || 0)));
  }

  setMinute(value: string): void {
    this.minute.set(Math.max(0, Math.min(59, Number(value) || 0)));
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
    if (!settings || this.saving() || this.enabledCategories().size === 0 || this.enabledDatasets().size === 0) return;
    const payload = this.buildPayload(settings);
    this.saving.set(true);
    this.service.updateSettings(payload)
      .pipe(finalize(() => this.saving.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.settings.set(response.settings);
          this.enabledDatasets.set(new Set(response.settings.datasets));
          this.messages.open(this.i18n.t('Overpass settings saved.'), undefined, { panelClass: 'snack-success', verticalPosition: 'top' });
        },
        error: () => this.showError(this.i18n.t('Could not save Overpass settings.'))
      });
  }

  loadDatabaseInfo(): void {
    this.loadingDatabaseInfo.set(true);
    this.service.getDatabaseInfo()
      .pipe(finalize(() => this.loadingDatabaseInfo.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (value) => this.databaseInfo.set(value),
        error: () => this.showError(this.i18n.t('Could not load database information.'))
      });
  }

  private hasActiveImport(): boolean {
    return this.databaseInfo()?.jobs.some((job) => job.status === 'queued' || job.status === 'running') ?? false;
  }

  private hasActiveMetadataJob(): boolean {
    return this.databaseInfo()?.metadataJobs?.some((job) => job.status === 'running') ?? false;
  }

  startImport(): void {
    if (this.importing() || this.hasChanges()) return;
    this.importing.set(true);
    this.service.startImport()
      .pipe(finalize(() => this.importing.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.messages.open(this.i18n.t('Import started.'), undefined, { panelClass: 'snack-success', verticalPosition: 'top' });
          this.loadDatabaseInfo();
        },
        error: () => this.showError(this.i18n.t('Could not start import.'))
      });
  }

  label(value: string): string {
    const labels: Record<string, string> = {
      accommodation: 'Accommodation', tourism: 'Tourism', leisure: 'Leisure', food_drink: 'Food & drink', amenities: 'Public amenities',
      religion: 'Places of worship',
      hotel: 'Hotels', guest_house: 'Guest houses', hostel: 'Hostels', motel: 'Motels', apartment: 'Holiday apartments', chalet: 'Chalets', resort: 'Resorts',
      camp_site: 'Campsites', caravan_site: 'Caravan sites', alpine_hut: 'Alpine huts', wilderness_hut: 'Wilderness huts',
      attraction: 'Attractions', museum: 'Museums', gallery: 'Galleries', viewpoint: 'Viewpoints', zoo: 'Zoos', aquarium: 'Aquariums',
      theme_park: 'Theme parks', artwork: 'Artworks', picnic_site: 'Picnic sites', information: 'Tourist information', castle: 'Castles',
      monument: 'Monuments', memorial: 'Memorials', ruins: 'Ruins', archaeological_site: 'Archaeological sites', park: 'Parks',
      nature_reserve: 'Nature reserves', playground: 'Playgrounds', fitness_centre: 'Fitness centres', sports_centre: 'Sports centres',
      swimming_pool: 'Swimming pools', water_park: 'Water parks', miniature_golf: 'Miniature golf', golf_course: 'Golf courses',
      marina: 'Marinas', beach_resort: 'Beach resorts', bowling_alley: 'Bowling alleys', restaurant: 'Restaurants', cafe: 'Cafés',
      bar: 'Bars', pub: 'Pubs', fast_food: 'Fast food', biergarten: 'Beer gardens', toilets: 'Public toilets',
      townhall: 'Town halls', courthouse: 'Courthouses', tax_office: 'Tax offices', register_office: 'Register offices',
      public_service_office: 'Public service offices', government_office: 'Government offices',
      cathedral: 'Cathedrals', church: 'Churches', chapel: 'Chapels', mosque: 'Mosques', synagogue: 'Synagogues',
      temple: 'Temples', shrine: 'Shrines', monastery: 'Monasteries', place_of_worship: 'Other places of worship'
    };
    return this.i18n.t(labels[value] ?? value.replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase()));
  }

  categoryIcon(category: string): string {
    return ({
      accommodation: 'hotel', tourism: 'museum', leisure: 'park', food_drink: 'restaurant',
      amenities: 'account_balance', religion: 'church'
    } as Record<string, string>)[category] ?? 'category';
  }

  stageLabel(stage: string): string {
    const labels: Record<string, string> = {
      queued: 'Waiting',
      starting: 'Preparing import',
      downloading: 'Downloading source data',
      preparing_filter: 'Preparing POI filters',
      filtering: 'Filtering required POIs',
      extracting: 'Extracting region',
      converting: 'Converting geodata',
      importing: 'Normalizing and storing POIs',
      cleanup: 'Deleting temporary files',
      activating: 'Activating new data version',
      completed: 'Import completed',
      failed: 'Import failed'
    };
    return this.i18n.t(labels[stage] ?? stage.replaceAll('_', ' '));
  }

  stepLabel(job: OverpassImportJob): string {
    if (!job.stepNumber || !job.stepCount) return this.stageLabel(job.stage);
    return this.i18n.t('Step {{current}} of {{total}} – {{stage}}', {
      current: job.stepNumber,
      total: job.stepCount,
      stage: this.stageLabel(job.stage)
    });
  }

  formatBytes(value: number | string | null | undefined): string {
    const bytes = Number(value);
    if (!Number.isFinite(bytes) || bytes < 0) return '—';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let unit = 0;
    let amount = bytes;
    while (amount >= 1024 && unit < units.length - 1) {
      amount /= 1024;
      unit += 1;
    }
    return `${new Intl.NumberFormat(this.i18n.lang(), { maximumFractionDigits: unit ? 1 : 0 }).format(amount)} ${units[unit]}`;
  }

  processedDetails(job: OverpassImportJob): string | null {
    const processedBytes = Number(job.processedBytes);
    const totalBytes = Number(job.totalBytes);
    if (job.processedBytes != null && Number.isFinite(processedBytes) && processedBytes >= 0) {
      const bytes = job.totalBytes != null && Number.isFinite(totalBytes) && totalBytes > 0
        ? `${this.formatBytes(processedBytes)} / ${this.formatBytes(totalBytes)}`
        : this.formatBytes(processedBytes);
      return job.processedItems == null
        ? bytes
        : `${bytes} · ${new Intl.NumberFormat(this.i18n.lang()).format(Number(job.processedItems) || 0)} ${this.i18n.t('POIs')}`;
    }
    if (job.processedItems != null) {
      return `${new Intl.NumberFormat(this.i18n.lang()).format(Number(job.processedItems) || 0)} ${this.i18n.t('POIs')}`;
    }
    return null;
  }

  elapsed(job: OverpassImportJob): string | null {
    if (!job.startedAt) return null;
    const start = new Date(job.startedAt).getTime();
    const end = job.completedAt ? new Date(job.completedAt).getTime() : Date.now();
    return Number.isFinite(start) && Number.isFinite(end) ? this.formatDuration(Math.max(0, end - start)) : null;
  }

  remaining(job: OverpassImportJob): string | null {
    if (job.status !== 'running' || job.stepProgress == null
      || !job.startedAt || job.progress <= 1 || job.progress >= 100) return null;
    const elapsed = Date.now() - new Date(job.startedAt).getTime();
    if (!Number.isFinite(elapsed) || elapsed <= 0) return null;
    return this.formatDuration(elapsed / job.progress * (100 - job.progress));
  }

  metadataProgress(job: OverpassMetadataJob): number {
    if (!job.totalUrls) return job.status === 'succeeded' ? 100 : 0;
    return Math.max(0, Math.min(100, job.processedUrls / job.totalUrls * 100));
  }

  metadataElapsed(job: OverpassMetadataJob): string | null {
    const start = new Date(job.createdAt).getTime();
    const end = job.completedAt ? new Date(job.completedAt).getTime() : Date.now();
    return Number.isFinite(start) && Number.isFinite(end)
      ? this.formatDuration(Math.max(0, end - start))
      : null;
  }

  metadataRemaining(job: OverpassMetadataJob): string | null {
    if (job.status !== 'running' || job.processedUrls <= 0 || job.processedUrls >= job.totalUrls) return null;
    const elapsed = Date.now() - new Date(job.createdAt).getTime();
    if (!Number.isFinite(elapsed) || elapsed <= 0) return null;
    const averageRequestDuration = elapsed / job.processedUrls;
    return this.formatDuration(averageRequestDuration * (job.totalUrls - job.processedUrls));
  }

  private formatDuration(milliseconds: number): string {
    const totalMinutes = Math.max(0, Math.round(milliseconds / 60000));
    if (totalMinutes < 60) return this.i18n.t('{{count}} min', { count: Math.max(1, totalMinutes) });
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return minutes
      ? this.i18n.t('{{hours}} h {{minutes}} min', { hours, minutes })
      : this.i18n.t('{{count}} h', { count: hours });
  }

  private initialSubcategories(settings: OverpassImportSettings, category: string, catalog = this.catalog()): string[] {
    return Object.hasOwn(settings.subcategories ?? {}, category)
      ? [...(settings.subcategories[category] ?? [])]
      : [...(catalog?.categories[category] ?? [])];
  }

  private buildPayload(settings: OverpassImportSettings): OverpassImportSettings {
    const categories = [...this.enabledCategories()];
    return {
      ...settings,
      enabled: this.importsEnabled(),
      datasets: [...this.enabledDatasets()],
      categories,
      subcategories: Object.fromEntries(categories.map((category) => [category, this.selectedSubcategories()[category] ?? []])),
      scheduleType: this.scheduleType(),
      weekday: this.weekday(),
      hour: this.hour(),
      minute: this.minute(),
      timezone: this.timezone(),
      refreshSource: this.refreshSource()
    };
  }

  private comparable(settings: OverpassImportSettings): unknown {
    const categories = [...settings.categories].sort();
    return {
      enabled: settings.enabled,
      datasets: [...settings.datasets].sort(),
      categories,
      subcategories: Object.fromEntries(categories.map((category) => [category,
        [...this.initialSubcategories(settings, category)].sort()
      ])),
      scheduleType: settings.scheduleType,
      weekday: settings.weekday,
      hour: settings.hour,
      minute: settings.minute,
      timezone: settings.timezone,
      refreshSource: settings.refreshSource
    };
  }

  private showError(message: string): void {
    this.messages.open(message, undefined, { panelClass: 'snack-error', verticalPosition: 'top' });
  }
}
