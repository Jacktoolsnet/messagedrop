import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ViewChild, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { DomSanitizer, SafeHtml, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelect, MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { finalize, startWith } from 'rxjs';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog.component';
import { Multimedia } from '../../../interfaces/multimedia.interface';
import { NominatimPlace } from '../../../interfaces/nominatim-place.interface';
import { PublicContentSavePayload } from '../../../interfaces/public-content-save-payload.interface';
import { PublicContent } from '../../../interfaces/public-content.interface';
import { PublicProfile, PublicProfileSummary } from '../../../interfaces/public-profile.interface';
import { TenorApiResponse, TenorResult } from '../../../interfaces/tenor-response.interface';
import { AuthService } from '../../../services/auth/auth.service';
import { ContentStyleOption, ContentStyleService } from '../../../services/content/content-style.service';
import { PublicContentService } from '../../../services/content/public-content.service';
import { PublicProfileService } from '../../../services/content/public-profile.service';
import { NominatimService } from '../../../services/location/nominatim.service';
import { MAX_PUBLIC_HASHTAGS, normalizeHashtags } from '../../../utils/hashtag.util';

const EMPTY_MULTIMEDIA: Multimedia = {
  type: 'undefined',
  url: '',
  sourceUrl: '',
  attribution: '',
  title: '',
  description: '',
  contentId: '',
  oembed: null
};

@Component({
  selector: 'app-public-content-editor',
  imports: [
    CommonModule,
    DatePipe,
    RouterLink,
    ReactiveFormsModule,
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    MatDividerModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatChipsModule,
    MatProgressBarModule
  ],
  templateUrl: './public-content-editor.component.html',
  styleUrls: ['./public-content-editor.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PublicContentEditorComponent {
  @ViewChild('styleSelect') private styleSelect?: MatSelect;

  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly authService = inject(AuthService);
  private readonly publicContentService = inject(PublicContentService);
  private readonly publicProfileService = inject(PublicProfileService);
  private readonly styleService = inject(ContentStyleService);
  private readonly nominatimService = inject(NominatimService);

  readonly role = this.authService.role;
  readonly styleOptions = this.styleService.getStyleOptions();
  readonly previewCreatedAt = Date.now();
  readonly publicProfiles = this.publicProfileService.rows;
  readonly profilesLoading = this.publicProfileService.loading;

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly mediaLoading = signal(false);
  readonly tenorLoading = signal(false);
  readonly locationSearchLoading = signal(false);
  readonly currentContent = signal<PublicContent | null>(null);
  readonly multimedia = signal<Multimedia>({ ...EMPTY_MULTIMEDIA });
  readonly hashtags = signal<string[]>([]);
  readonly locationSearchResults = signal<NominatimPlace[]>([]);
  readonly selectedLocationLabel = signal('');
  readonly tenorResults = signal<TenorResult[]>([]);
  readonly tenorNext = signal('');
  readonly lastTenorSearch = signal('');

  readonly isEditMode = computed(() => this.currentContent() !== null);
  readonly isPublished = computed(() => this.currentContent()?.status === 'published');
  readonly isDeleted = computed(() => this.currentContent()?.status === 'deleted');
  readonly canPublish = computed(() => ['editor', 'admin', 'root'].includes(this.role() ?? ''));
  readonly hasMedia = computed(() => this.multimedia().type !== 'undefined');
  readonly safeOembedHtml = computed<SafeHtml | null>(() => {
    const html = this.multimedia().oembed?.html;
    return html ? this.sanitizer.bypassSecurityTrustHtml(html) : null;
  });
  readonly tiktokEmbedUrl = computed<SafeResourceUrl | null>(() => {
    if ((this.multimedia().type || '').toLowerCase() !== 'tiktok') {
      return null;
    }

    const id = this.getTikTokId(this.multimedia());
    if (!id) {
      return null;
    }

    return this.sanitizer.bypassSecurityTrustResourceUrl(`https://www.tiktok.com/embed/v2/${id}`);
  });
  readonly pageTitle = computed(() => this.isEditMode() ? 'Edit public message' : 'Create public message');
  readonly statusLabel = computed(() => this.formatStatus(this.currentContent()?.status ?? 'draft'));
  readonly maxPublicHashtags = MAX_PUBLIC_HASHTAGS;

  readonly hashtagControl = new FormControl('', { nonNullable: true });
  readonly mediaUrlControl = new FormControl('', { nonNullable: true });
  readonly tenorControl = new FormControl('', { nonNullable: true });
  readonly locationSearchControl = new FormControl('', { nonNullable: true });

  readonly form = this.fb.nonNullable.group({
    message: this.fb.nonNullable.control(''),
    style: this.fb.nonNullable.control(''),
    publicProfileId: this.fb.nonNullable.control(''),
    location: this.fb.nonNullable.group({
      latitude: this.fb.nonNullable.control(0),
      longitude: this.fb.nonNullable.control(0),
      plusCode: this.fb.nonNullable.control('')
    })
  });
  readonly formValue = toSignal(
    this.form.valueChanges.pipe(startWith(this.form.getRawValue())),
    { initialValue: this.form.getRawValue() }
  );
  readonly locationValue = toSignal(
    this.form.controls.location.valueChanges.pipe(startWith(this.form.controls.location.getRawValue())),
    { initialValue: this.form.controls.location.getRawValue() }
  );
  readonly selectedProfile = computed<PublicProfileSummary | PublicProfile | null>(() => {
    const selectedId = (this.formValue().publicProfileId ?? '').trim();
    if (!selectedId) {
      return null;
    }

    const serviceMatch = this.publicProfiles().find((row) => row.id === selectedId);
    if (serviceMatch) {
      return serviceMatch;
    }

    const currentProfile = this.currentContent()?.publicProfile;
    if (currentProfile?.id === selectedId) {
      return currentProfile;
    }

    return null;
  });
  readonly selectedProfileAttribution = computed(() => this.selectedProfile()?.avatarAttribution ?? null);
  readonly selectedStyle = computed(() => this.styleService.normalizeStyle(this.formValue().style));
  readonly selectedProfileDefaultStyle = computed(() => this.styleService.normalizeStyle(this.selectedProfile()?.defaultStyle));
  readonly previewStyleOverride = signal('');
  readonly selectedStyleOption = computed(() => this.styleService.findOptionByStyle(this.selectedStyle()));
  readonly profileDefaultStyleOption = computed(() => this.styleService.findOptionByStyle(this.selectedProfileDefaultStyle()));
  readonly previewDisplayStyle = computed(() => (
    this.previewStyleOverride()
    || this.selectedStyle()
    || this.selectedProfileDefaultStyle()
  ));
  readonly previewMessage = computed(() => {
    const message = (this.formValue().message ?? '').trim();
    if (message) {
      return message;
    }
    return this.hasMedia() ? '' : 'Add some text to preview the message.';
  });
  readonly previewLocationLabel = computed(() => {
    const selectedLabel = this.selectedLocationLabel().trim();
    if (selectedLabel) {
      return selectedLabel;
    }

    const location = this.locationValue();
    const latitude = Number(location?.latitude) || 0;
    const longitude = Number(location?.longitude) || 0;
    const plusCode = (location?.plusCode ?? '').trim();
    const parts: string[] = [];

    if (plusCode) {
      parts.push(plusCode);
    }
    if (latitude !== 0 || longitude !== 0) {
      parts.push(`${this.formatCoordinate(latitude)}, ${this.formatCoordinate(longitude)}`);
    }

    return parts.join(' • ');
  });
  readonly activeLocationLabel = computed(() => this.selectedLocationLabel().trim() || this.previewLocationLabel());
  readonly hasSelectedLocation = computed(() => !!this.activeLocationLabel());
  readonly hasSelectedPublicProfile = computed(() => !!this.selectedProfile());
  readonly canSaveContent = computed(() => this.hasSelectedLocation() && this.hasSelectedPublicProfile() && !this.saving());
  readonly selectedLocationCoordinates = computed(() => {
    const location = this.locationValue();
    const latitude = Number(location?.latitude) || 0;
    const longitude = Number(location?.longitude) || 0;
    if (latitude === 0 && longitude === 0) {
      return null;
    }
    return { latitude, longitude };
  });
  readonly locationMapEmbedUrl = computed<SafeResourceUrl | null>(() => {
    const coordinates = this.selectedLocationCoordinates();
    if (!coordinates) {
      return null;
    }
    return this.sanitizer.bypassSecurityTrustResourceUrl(
      this.buildLocationMapEmbedUrl(coordinates.latitude, coordinates.longitude)
    );
  });
  readonly locationMapLink = computed(() => {
    const coordinates = this.selectedLocationCoordinates();
    if (!coordinates) {
      return '';
    }
    return this.buildLocationMapLink(coordinates.latitude, coordinates.longitude);
  });

  constructor() {
    this.publicProfileService.loadProfiles();
    effect(() => {
      const currentContent = this.currentContent();
      const selectedProfileId = this.form.controls.publicProfileId.value.trim();
      const publicProfiles = this.publicProfiles();

      if (currentContent || selectedProfileId || publicProfiles.length === 0) {
        return;
      }

      this.form.controls.publicProfileId.setValue(publicProfiles[0].id);
    }, { allowSignalWrites: true });

    const contentId = this.route.snapshot.paramMap.get('id');
    if (contentId) {
      this.loadContent(contentId);
    }
  }

  trackTenorResult(_index: number, result: TenorResult): string {
    return result.id;
  }

  trackStyleOption(_index: number, option: ContentStyleOption): string {
    return option.fontFamily;
  }

  trackPublicProfile(_index: number, profile: PublicProfile): string {
    return profile.id;
  }

  trackLocationResult(_index: number, place: NominatimPlace): number {
    return place.place_id;
  }

  previewStyleOption(style: string | null | undefined): void {
    this.previewStyleOverride.set(this.styleService.normalizeStyle(style));
  }

  resetPreviewStyle(): void {
    this.previewStyleOverride.set('');
  }

  handleStyleSelectOpenedChange(open: boolean): void {
    if (!open) {
      this.resetPreviewStyle();
      return;
    }

    queueMicrotask(() => this.syncActiveStylePreview());
  }

  handleStyleSelectKeydown(): void {
    queueMicrotask(() => this.syncActiveStylePreview());
  }

  isImageMultimedia(multimedia: Multimedia): boolean {
    if (!multimedia.url) {
      return false;
    }

    if (multimedia.type === 'image' || multimedia.type === 'tenor') {
      return true;
    }

    return /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(multimedia.url);
  }

  searchLocations(): void {
    const searchTerm = this.locationSearchControl.value.trim();
    if (!searchTerm) {
      this.locationSearchResults.set([]);
      return;
    }

    this.locationSearchLoading.set(true);
    this.nominatimService.searchPlaces(searchTerm)
      .pipe(
        finalize(() => this.locationSearchLoading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (results) => {
          this.locationSearchResults.set(results);
          if (results.length === 0) {
            this.showMessage('No places found for this search.');
          }
        },
        error: () => {
          this.locationSearchResults.set([]);
          this.showMessage('Location search failed.');
        }
      });
  }

  selectLocationResult(place: NominatimPlace): void {
    const latitude = Number(place.lat);
    const longitude = Number(place.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      this.showMessage('The selected place does not contain valid coordinates.');
      return;
    }

    const label = this.getLocationLabel(place);
    this.form.controls.location.setValue({
      latitude,
      longitude,
      plusCode: ''
    });
    this.selectedLocationLabel.set(label);
    this.locationSearchControl.setValue(label);
  }

  clearLocation(): void {
    this.form.controls.location.setValue({
      latitude: 0,
      longitude: 0,
      plusCode: ''
    });
    this.selectedLocationLabel.set('');
    this.locationSearchControl.setValue('');
    this.locationSearchResults.set([]);
  }

  openPublicProfiles(): void {
    this.router.navigate(['/dashboard/content/profiles']);
  }

  profileAvatar(): string {
    return this.selectedProfile()?.avatarImage?.trim() || '';
  }

  profileName(): string {
    return this.selectedProfile()?.name?.trim() || 'No public profile selected';
  }

  profileInitials(): string {
    const parts = this.profileName().split(/\s+/).filter(Boolean).slice(0, 2);
    return parts.map((part) => part.charAt(0).toUpperCase()).join('') || 'P';
  }

  formatStatus(status: string): string {
    switch (status) {
      case 'published':
        return 'Published';
      case 'withdrawn':
        return 'Withdrawn';
      case 'deleted':
        return 'Deleted';
      case 'draft':
      default:
        return 'Draft';
    }
  }

  statusClass(status: string | null | undefined): string {
    switch (status) {
      case 'published':
        return 'status-published';
      case 'withdrawn':
        return 'status-withdrawn';
      case 'deleted':
        return 'status-deleted';
      case 'draft':
      default:
        return 'status-draft';
    }
  }

  statusIcon(status: string | null | undefined): string {
    switch (status) {
      case 'published':
        return 'campaign';
      case 'withdrawn':
        return 'unpublished';
      case 'deleted':
        return 'delete_outline';
      case 'draft':
      default:
        return 'edit_note';
    }
  }

  randomizeStyle(): void {
    this.form.controls.style.setValue(this.styleService.getRandomStyle());
  }

  clearStyle(): void {
    this.form.controls.style.setValue('');
  }

  addHashtagsFromInput(candidate?: string): void {
    const rawCandidate = candidate ?? this.hashtagControl.value;
    const trimmedCandidate = rawCandidate.trim();
    if (!trimmedCandidate) {
      return;
    }

    const parsed = normalizeHashtags(trimmedCandidate, MAX_PUBLIC_HASHTAGS);
    if (parsed.invalidTokens.length > 0) {
      this.showMessage('Hashtags may only contain letters, numbers and underscores.');
      return;
    }

    const merged = normalizeHashtags([...this.hashtags(), ...parsed.tags], MAX_PUBLIC_HASHTAGS);
    if (merged.overflow > 0) {
      this.showMessage(`A maximum of ${MAX_PUBLIC_HASHTAGS} hashtags is allowed.`);
      return;
    }

    this.hashtags.set([...merged.tags]);
    this.hashtagControl.setValue('');
  }

  onHashtagKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ',' || event.key === ';') {
      event.preventDefault();
      this.addHashtagsFromInput();
    }
  }

  removeHashtag(tag: string): void {
    this.hashtags.update((current) => current.filter((entry) => entry !== tag));
  }

  removeMultimedia(): void {
    this.multimedia.set({ ...EMPTY_MULTIMEDIA });
  }

  importExternalMultimedia(): void {
    const url = this.mediaUrlControl.value.trim();
    if (!url) {
      this.showMessage('Please enter a media URL first.');
      return;
    }

    this.mediaLoading.set(true);
    this.publicContentService.resolveOembed(url)
      .pipe(
        finalize(() => this.mediaLoading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (multimedia) => {
          this.multimedia.set(multimedia);
          this.mediaUrlControl.setValue('');
          this.showMessage('External media imported.');
        },
        error: () => undefined
      });
  }

  loadFeaturedTenor(): void {
    this.tenorLoading.set(true);
    this.publicContentService.getFeaturedTenor()
      .pipe(
        finalize(() => this.tenorLoading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => {
          this.applyTenorResponse(response, '');
        },
        error: () => undefined
      });
  }

  searchTenor(reset = true): void {
    const term = this.tenorControl.value.trim();
    if (!term) {
      this.loadFeaturedTenor();
      return;
    }

    const next = reset ? '' : this.tenorNext();
    this.tenorLoading.set(true);
    this.publicContentService.searchTenor(term, next)
      .pipe(
        finalize(() => this.tenorLoading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => {
          this.applyTenorResponse(response, term);
        },
        error: () => undefined
      });
  }

  loadMoreTenor(): void {
    const next = this.tenorNext();
    if (!next) {
      return;
    }

    const term = this.tenorControl.value.trim();
    this.tenorLoading.set(true);
    const request$ = term
      ? this.publicContentService.searchTenor(term, next)
      : this.publicContentService.getFeaturedTenor(next);

    request$
      .pipe(
        finalize(() => this.tenorLoading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => {
          this.applyTenorResponse(response, term);
        },
        error: () => undefined
      });
  }

  selectTenorResult(result: TenorResult): void {
    this.multimedia.set({
      type: 'tenor',
      url: result.media_formats.gif.url,
      sourceUrl: result.itemurl,
      attribution: 'Powered by Tenor',
      title: result.title,
      description: result.content_description,
      contentId: '',
      oembed: null
    });
    this.showMessage('Tenor GIF selected.');
  }

  saveDraft(): void {
    this.persist('draft');
  }

  saveAndPublish(): void {
    if (!this.canPublish()) {
      this.showMessage('Only editors can publish public messages.');
      return;
    }

    this.persist('publish');
  }

  confirmWithdraw(): void {
    const content = this.currentContent();
    if (!content) {
      return;
    }

    this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Withdraw publication?',
        message: 'The public message will be removed from the public backend and can be edited again afterwards.',
        confirmText: 'Withdraw',
        cancelText: 'Cancel',
        warn: true
      }
    }).afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }

        this.saving.set(true);
        this.publicContentService.withdrawPublicContent(content.id)
          .pipe(
            finalize(() => this.saving.set(false)),
            takeUntilDestroyed(this.destroyRef)
          )
          .subscribe({
            next: (row) => {
              this.applyContent(row);
              this.showMessage('Public message withdrawn.');
            },
            error: () => undefined
          });
      });
  }

  confirmDelete(): void {
    const content = this.currentContent();
    if (!content) {
      return;
    }

    this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete content?',
        message: 'This draft or publication record will be deleted permanently.',
        confirmText: 'Delete',
        cancelText: 'Cancel',
        warn: true
      }
    }).afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }

        this.saving.set(true);
        this.publicContentService.deletePublicContent(content.id)
          .pipe(
            finalize(() => this.saving.set(false)),
            takeUntilDestroyed(this.destroyRef)
          )
          .subscribe({
            next: () => {
              this.showMessage('Content deleted.');
              this.router.navigate(['/dashboard/content']);
            },
            error: () => undefined
          });
      });
  }

  private persist(mode: 'draft' | 'publish'): void {
    if (this.isPublished()) {
      this.showMessage('Withdraw the public message before editing it.');
      return;
    }
    if (this.isDeleted()) {
      this.showMessage('Deleted content cannot be edited.');
      return;
    }

    const payload = this.buildPayload();
    if (!payload) {
      return;
    }

    this.saving.set(true);
    const request$ = this.currentContent()
      ? this.publicContentService.updatePublicContent(this.currentContent()!.id, payload)
      : this.publicContentService.createPublicContent(payload);

    request$
      .pipe(
        finalize(() => {
          if (mode === 'draft') {
            this.saving.set(false);
          }
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (row) => {
          if (mode === 'draft') {
            this.applyContent(row, true);
            this.showMessage('Draft saved.');
            return;
          }
          this.publishSavedContent(row.id);
        },
        error: () => this.saving.set(false)
      });
  }

  private publishSavedContent(id: string): void {
    this.publicContentService.publishPublicContent(id)
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (row) => {
          this.applyContent(row, true);
          this.showMessage('Public message published.');
        },
        error: () => undefined
      });
  }

  private buildPayload(): PublicContentSavePayload | null {
    const pendingHashtagInput = this.hashtagControl.value.trim();
    this.addHashtagsFromInput();
    if (pendingHashtagInput && this.hashtagControl.value.trim()) {
      return null;
    }

    const raw = this.form.getRawValue();
    const message = raw.message.trim();
    const multimedia = this.multimedia();

    if (!message && multimedia.type === 'undefined') {
      this.showMessage('Please add text or multimedia before saving.');
      return null;
    }
    if (!this.hasSelectedPublicProfile()) {
      this.showMessage('Please select a public profile before saving.');
      return null;
    }
    if (!this.hasSelectedLocation()) {
      this.showMessage('Please select a location before saving.');
      return null;
    }

    return {
      publicProfileId: raw.publicProfileId.trim(),
      message,
      location: {
        latitude: Number(raw.location.latitude) || 0,
        longitude: Number(raw.location.longitude) || 0,
        plusCode: raw.location.plusCode.trim(),
        label: this.activeLocationLabel()
      },
      markerType: 'default',
      style: this.styleService.normalizeStyle(raw.style) || this.selectedProfileDefaultStyle(),
      hashtags: this.hashtags(),
      multimedia
    };
  }

  private loadContent(id: string): void {
    this.loading.set(true);
    this.publicContentService.getPublicContent(id)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (row) => this.applyContent(row),
        error: () => this.router.navigate(['/dashboard/content'])
      });
  }

  private applyContent(content: PublicContent, updateRoute = false): void {
    const storedLocationLabel = this.normalizeLocationLabel((content.location?.label ?? '').trim());
    this.currentContent.set(content);
    this.multimedia.set(content.multimedia ?? { ...EMPTY_MULTIMEDIA });
    this.hashtags.set(Array.isArray(content.hashtags) ? [...content.hashtags] : []);
    this.selectedLocationLabel.set(storedLocationLabel);
    this.locationSearchResults.set([]);
    this.locationSearchControl.setValue(this.formatStoredLocation(content));
    this.form.setValue({
      message: content.message ?? '',
      style: this.styleService.normalizeStyle(content.style ?? ''),
      publicProfileId: content.publicProfile?.id ?? '',
      location: {
        latitude: Number(content.location?.latitude ?? 0),
        longitude: Number(content.location?.longitude ?? 0),
        plusCode: content.location?.plusCode ?? ''
      }
    });
    this.updateFormState();

    if (updateRoute && this.route.snapshot.paramMap.get('id') !== content.id) {
      this.router.navigate(['/dashboard/content', content.id, 'edit']);
    }
  }

  private updateFormState(): void {
    const disableEditing = this.isPublished() || this.isDeleted();
    if (disableEditing) {
      this.form.disable({ emitEvent: false });
      this.hashtagControl.disable({ emitEvent: false });
      this.mediaUrlControl.disable({ emitEvent: false });
      this.tenorControl.disable({ emitEvent: false });
      this.locationSearchControl.disable({ emitEvent: false });
      return;
    }

    this.form.enable({ emitEvent: false });
    this.hashtagControl.enable({ emitEvent: false });
    this.mediaUrlControl.enable({ emitEvent: false });
    this.tenorControl.enable({ emitEvent: false });
    this.locationSearchControl.enable({ emitEvent: false });
  }

  private applyTenorResponse(response: TenorApiResponse, searchTerm: string): void {
    this.tenorResults.set(response.data?.results ?? []);
    this.tenorNext.set(response.data?.next ?? '');
    this.lastTenorSearch.set(searchTerm);
  }

  private showMessage(message: string): void {
    this.snackBar.open(message, 'OK', { duration: 2800 });
  }

  private getLocationLabel(place: NominatimPlace): string {
    return this.normalizeLocationLabel(
      place.name?.trim()
      || place.address?.city?.trim()
      || place.address?.town?.trim()
      || place.address?.village?.trim()
      || place.address?.suburb?.trim()
      || place.display_name?.trim()
      || `${place.lat}, ${place.lon}`
    );
  }

  private formatStoredLocation(content: PublicContent): string {
    const label = this.normalizeLocationLabel(content.location?.label?.trim() ?? '');
    if (label) {
      return label;
    }

    const plusCode = content.location?.plusCode?.trim() ?? '';
    if (plusCode) {
      return plusCode;
    }

    const latitude = Number(content.location?.latitude ?? 0);
    const longitude = Number(content.location?.longitude ?? 0);
    if (latitude !== 0 || longitude !== 0) {
      return `${this.formatCoordinate(latitude)}, ${this.formatCoordinate(longitude)}`;
    }

    return '';
  }

  private syncActiveStylePreview(): void {
    const activeOption = this.styleSelect?.options?.toArray().find((option) => option.active);
    if (!activeOption) {
      this.resetPreviewStyle();
      return;
    }

    this.previewStyleOption(activeOption.value as string | null | undefined);
  }

  private formatCoordinate(value: number): string {
    return value.toFixed(5).replace(/\.?0+$/, '');
  }

  private normalizeLocationLabel(value: string): string {
    const normalized = String(value || '').trim();
    if (!normalized) {
      return '';
    }

    const firstSegment = normalized.split(',')[0]?.trim();
    return firstSegment || normalized;
  }

  private buildLocationMapEmbedUrl(latitude: number, longitude: number): string {
    const latitudeDelta = 0.006;
    const longitudeDelta = Math.max(0.006 / Math.cos((latitude * Math.PI) / 180), 0.006);
    const minLatitude = Math.max(-85, latitude - latitudeDelta);
    const maxLatitude = Math.min(85, latitude + latitudeDelta);
    const minLongitude = Math.max(-180, longitude - longitudeDelta);
    const maxLongitude = Math.min(180, longitude + longitudeDelta);
    const bbox = [
      minLongitude.toFixed(6),
      minLatitude.toFixed(6),
      maxLongitude.toFixed(6),
      maxLatitude.toFixed(6)
    ].join(',');

    return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${encodeURIComponent(`${latitude},${longitude}`)}`;
  }

  private buildLocationMapLink(latitude: number, longitude: number): string {
    return `https://www.openstreetmap.org/?mlat=${encodeURIComponent(String(latitude))}&mlon=${encodeURIComponent(String(longitude))}#map=15/${encodeURIComponent(String(latitude))}/${encodeURIComponent(String(longitude))}`;
  }

  private getTikTokId(multimedia: Multimedia): string | null {
    const sourceUrl = String(multimedia.sourceUrl || multimedia.url || '').trim();
    if (sourceUrl) {
      try {
        const parsed = new URL(sourceUrl);
        const normalizedHost = parsed.hostname.toLowerCase();
        const isTikTokHost = normalizedHost === 'tiktok.com'
          || normalizedHost === 'www.tiktok.com'
          || normalizedHost.endsWith('.tiktok.com')
          || normalizedHost === 'vm.tiktok.com';

        if (isTikTokHost) {
          const match = parsed.pathname.match(/\/@[^/]+\/video\/(\d+)/);
          const safeMatch = this.sanitizeTikTokId(match?.[1] || null);
          if (safeMatch) {
            return safeMatch;
          }
        }
      } catch {
        // ignore
      }
    }

    return this.sanitizeTikTokId(multimedia.contentId || null);
  }

  private sanitizeTikTokId(value: string | null | undefined): string | null {
    const normalized = String(value || '').trim();
    if (!normalized || !/^\d+$/.test(normalized)) {
      return null;
    }
    return normalized;
  }
}
