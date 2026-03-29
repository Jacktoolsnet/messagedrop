import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ViewChild, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { DomSanitizer, SafeHtml, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatBadgeModule } from '@angular/material/badge';
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
import { MatToolbarModule } from '@angular/material/toolbar';
import { combineLatest, finalize, startWith } from 'rxjs';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog.component';
import { PublicContentAiDialogComponent, PublicContentAiDialogResult } from '../public-content-ai-dialog/public-content-ai-dialog.component';
import { PublicContentLocationMapDialogComponent, PublicContentLocationMapDialogResult } from '../public-content-location-map-dialog/public-content-location-map-dialog.component';
import { AiTool } from '../../../interfaces/ai-tool.type';
import { Multimedia } from '../../../interfaces/multimedia.interface';
import { NominatimPlace } from '../../../interfaces/nominatim-place.interface';
import { PublicContentSavePayload } from '../../../interfaces/public-content-save-payload.interface';
import { PublicContentType } from '../../../interfaces/public-content-type.type';
import { PublicContent } from '../../../interfaces/public-content.interface';
import { ExternalPublicContent } from '../../../interfaces/external-public-content.interface';
import { PublicProfile, PublicProfileSummary } from '../../../interfaces/public-profile.interface';
import { TenorApiResponse, TenorResult } from '../../../interfaces/tenor-response.interface';
import { AuthService } from '../../../services/auth/auth.service';
import { AiService } from '../../../services/content/ai.service';
import { ContentStyleOption, ContentStyleService } from '../../../services/content/content-style.service';
import { PublicContentService } from '../../../services/content/public-content.service';
import { PublicProfileService } from '../../../services/content/public-profile.service';
import { NominatimService } from '../../../services/location/nominatim.service';
import { TranslationHelperService } from '../../../services/translation-helper.service';
import { MAX_PUBLIC_HASHTAGS, normalizeHashtags } from '../../../utils/hashtag.util';
import { DisplayMessageService } from '../../../services/display-message.service';

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
    MatBadgeModule,
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
  private readonly snackBar = inject(DisplayMessageService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly authService = inject(AuthService);
  private readonly aiService = inject(AiService);
  private readonly publicContentService = inject(PublicContentService);
  private readonly publicProfileService = inject(PublicProfileService);
  private readonly styleService = inject(ContentStyleService);
  private readonly nominatimService = inject(NominatimService);
  readonly i18n = inject(TranslationHelperService);

  readonly role = this.authService.role;
  readonly styleOptions = this.styleService.getStyleOptions();
  readonly previewCreatedAt = Date.now();
  readonly publicProfiles = this.publicProfileService.rows;
  readonly profilesLoading = this.publicProfileService.loading;
  readonly aiSettings = this.aiService.settings;
  readonly aiSettingsLoading = this.aiService.settingsLoading;

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly mediaLoading = signal(false);
  readonly tenorLoading = signal(false);
  readonly locationSearchLoading = signal(false);
  readonly currentContent = signal<PublicContent | null>(null);
  readonly selectedParentContent = signal<PublicContent | null>(null);
  readonly childCommentsLoading = signal(false);
  readonly childComments = signal<PublicContent[]>([]);
  readonly externalCommentsLoading = signal(false);
  readonly externalComments = signal<ExternalPublicContent[]>([]);
  readonly selectedExternalParent = signal<ExternalPublicContent | null>(null);
  readonly selectedExternalParentUuid = signal('');
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
  readonly canCreateCommentFromCurrent = computed(() => {
    const content = this.currentContent();
    return !!content && content.status !== 'deleted';
  });
  readonly canPublish = computed(() => ['editor', 'admin', 'root'].includes(this.role() ?? ''));
  readonly hasMedia = computed(() => this.multimedia().type !== 'undefined');
  readonly aiParentContextLabel = computed(() => this.hasSelectedParentContent() ? this.previewParentLabel() : '');
  readonly hasAiTextSource = computed(() => !!(this.formValue().message ?? '').trim());
  readonly hasAiContext = computed(() => (
    this.hasAiTextSource()
    || this.hasMedia()
    || !!this.activeLocationLabel()
    || !!this.aiParentContextLabel()
  ));
  readonly aiConfigured = computed(() => this.aiSettings()?.apiConfigured !== false);
  readonly aiModelLabel = computed(() => (
    this.aiSettings()?.selectedModel
    || this.aiSettings()?.defaultModel
    || 'gpt-5.4'
  ));
  readonly canUseAiTools = computed(() => !this.isPublished() && !this.isDeleted() && this.aiConfigured());
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
  readonly contentType = computed<PublicContentType>(() => (this.formValue().contentType ?? 'public') === 'comment' ? 'comment' : 'public');
  readonly isCommentMode = computed(() => this.contentType() === 'comment');
  readonly pageTitle = computed(() => {
    if (this.isCommentMode()) {
      return this.isEditMode() ? this.i18n.t('Edit public comment') : this.i18n.t('Create public comment');
    }
    return this.isEditMode() ? this.i18n.t('Edit public message') : this.i18n.t('Create public message');
  });
  readonly statusLabel = computed(() => this.formatStatus(this.currentContent()?.status ?? 'draft'));
  readonly childCommentsTitle = computed(() => this.i18n.t('Comments'));
  readonly childCommentsSubtitle = computed(() => (
    this.isCommentMode()
      ? this.i18n.t('Direct comments for this comment.')
      : this.i18n.t('Direct comments for this message.')
  ));
  readonly maxPublicHashtags = MAX_PUBLIC_HASHTAGS;

  readonly hashtagControl = new FormControl('', { nonNullable: true });
  readonly mediaUrlControl = new FormControl('', { nonNullable: true });
  readonly tenorControl = new FormControl('', { nonNullable: true });
  readonly locationSearchControl = new FormControl('', { nonNullable: true });

  readonly form = this.fb.nonNullable.group({
    contentType: this.fb.nonNullable.control<PublicContentType>('public'),
    parentContentId: this.fb.nonNullable.control(''),
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
    return this.hasMedia() ? '' : this.i18n.t('Add some text to preview the message.');
  });
  readonly previewLocationLabel = computed(() => {
    if (this.isCommentMode()) {
      return '';
    }

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
  readonly hasSelectedLocation = computed(() => this.isCommentMode() || !!this.activeLocationLabel());
  readonly hasSelectedPublicProfile = computed(() => !!this.selectedProfile());
  readonly selectedParentSummary = computed(() => {
    const selectedExternalParentUuid = this.selectedExternalParentUuid().trim()
      || this.currentContent()?.externalParentMessageUuid?.trim()
      || '';
    if (selectedExternalParentUuid) {
      const externalParent = this.selectedExternalParent();
      return {
        id: selectedExternalParentUuid,
        contentType: externalParent?.contentType ?? 'comment',
        status: externalParent?.status ?? 'published',
        message: externalParent?.message ?? '',
        locationLabel: '',
        publishedMessageUuid: selectedExternalParentUuid,
        publicProfileName: externalParent?.displayName || 'Public visitor',
        isExternal: true
      };
    }

    const parent = this.selectedParentContent();
    if (parent) {
      return {
        id: parent.id,
        contentType: parent.contentType,
        status: parent.status,
        message: parent.message,
        locationLabel: parent.location.label,
        publishedMessageUuid: parent.publishedMessageUuid,
        publicProfileName: parent.publicProfile?.name || '',
        isExternal: false
      };
    }
    const currentParent = this.currentContent()?.parentContent;
    if (!currentParent) {
      return null;
    }
    return {
      ...currentParent,
      isExternal: false
    };
  });
  readonly hasSelectedParentContent = computed(() => (
    !!this.selectedExternalParentUuid().trim()
    || !!(this.formValue().parentContentId ?? '').trim()
  ));
  readonly canOpenInternalParentContent = computed(() => {
    const parent = this.selectedParentSummary();
    return !!parent && !parent.isExternal;
  });
  readonly previewParentLabel = computed(() => {
    const parent = this.selectedParentSummary();
    if (!parent) {
      return this.i18n.t('No parent content selected');
    }
    const profile = parent.publicProfileName?.trim();
    const location = parent.locationLabel?.trim();
    if (profile && location) {
      return `${profile} • ${location}`;
    }
    if (location) {
      return location;
    }
    if (profile) {
      return profile;
    }
    return parent.isExternal ? this.i18n.t('Selected public comment') : this.i18n.t('Selected parent content');
  });
  readonly canSaveContent = computed(() => {
    if (this.saving() || !this.hasSelectedPublicProfile()) {
      return false;
    }
    return this.isCommentMode() ? this.hasSelectedParentContent() : this.hasSelectedLocation();
  });
  readonly selectedLocationCoordinates = computed(() => {
    if (this.isCommentMode()) {
      return null;
    }
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
  readonly backTarget = computed(() => {
    const parentId = this.resolveBackParentId();
    return parentId ? ['/dashboard/content', parentId, 'edit'] : ['/dashboard/content'];
  });
  readonly backAriaLabel = computed(() => (
    this.resolveBackParentId() ? this.i18n.t('Back to parent content') : this.i18n.t('Back to content overview')
  ));
  readonly canLoadExternalComments = computed(() => {
    const content = this.currentContent();
    return !!content
      && content.status === 'published'
      && !!content.publishedMessageUuid?.trim();
  });

  constructor() {
    this.publicProfileService.loadProfiles();
    this.aiService.loadSettings();
    effect(() => {
      const currentContent = this.currentContent();
      const selectedProfileId = this.form.controls.publicProfileId.value.trim();
      const publicProfiles = this.publicProfiles();

      if (currentContent || selectedProfileId || publicProfiles.length === 0) {
        return;
      }

      this.form.controls.publicProfileId.setValue(publicProfiles[0].id);
    }, { allowSignalWrites: true });

    combineLatest([this.route.paramMap, this.route.queryParamMap])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([paramMap, queryParamMap]) => {
        const contentId = paramMap.get('id')?.trim() || '';
        const requestedType = queryParamMap.get('type')?.trim() || '';
        const parentId = queryParamMap.get('parentId')?.trim() || '';
        const externalParentUuid = queryParamMap.get('externalParentUuid')?.trim() || '';

        this.applyRouteState(contentId, requestedType, parentId, externalParentUuid);
      });
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

  openLocationMapDialog(): void {
    const coordinates = this.selectedLocationCoordinates();
    if (!coordinates) {
      return;
    }

    this.dialog.open<PublicContentLocationMapDialogComponent, { latitude: number; longitude: number; label: string; }, PublicContentLocationMapDialogResult>(
      PublicContentLocationMapDialogComponent,
      {
        data: {
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
          label: this.activeLocationLabel()
        },
        width: 'min(92vw, 980px)',
        maxWidth: '92vw',
        maxHeight: '92vh',
        autoFocus: false,
        panelClass: 'mdp-dialog-xl'
      }
    ).afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (!result) {
          return;
        }

        this.form.controls.location.setValue({
          latitude: Number(result.latitude) || 0,
          longitude: Number(result.longitude) || 0,
          plusCode: ''
        });
        const normalizedLabel = this.normalizeLocationLabel(result.label);
        this.selectedLocationLabel.set(normalizedLabel);
        this.locationSearchControl.setValue(normalizedLabel);
      });
  }

  openPublicProfiles(): void {
    this.router.navigate(['/dashboard/content/profiles']);
  }

  openAiSettings(): void {
    this.router.navigate(['/dashboard/content/ai'], {
      queryParams: {
        returnTo: this.router.url
      }
    });
  }

  openParentContent(): void {
    const parent = this.selectedParentSummary();
    if (!parent || parent.isExternal) {
      return;
    }
    this.router.navigate(['/dashboard/content', parent.id, 'edit']);
  }

  createCommentFromCurrent(): void {
    const content = this.currentContent();
    if (!content) {
      return;
    }
    this.openCreateCommentForContent(content.id);
  }

  private openCreateCommentForContent(parentContentId: string): void {
    this.router.navigate(['/dashboard/content/create'], {
      queryParams: {
        type: 'comment',
        parentId: parentContentId
      }
    });
  }

  trackChildComment(_index: number, row: PublicContent): string {
    return row.id;
  }

  trackExternalComment(_index: number, row: ExternalPublicContent): string {
    return row.uuid;
  }

  openChildComment(row: PublicContent): void {
    this.router.navigate(['/dashboard/content', row.id, 'edit']);
  }

  replyToExternalComment(row: ExternalPublicContent): void {
    const currentContent = this.currentContent();
    if (!currentContent) {
      return;
    }

    this.router.navigate(['/dashboard/content/create'], {
      queryParams: {
        type: 'comment',
        parentId: currentContent.id,
        externalParentUuid: row.uuid
      }
    });
  }

  childCommentCount(row: PublicContent): number {
    return Math.max(0, Number(row.childCommentCount ?? 0));
  }

  childHasImageMultimedia(row: PublicContent): boolean {
    return this.isImageMultimedia(row.multimedia);
  }

  childResolvedStyle(row: PublicContent): string {
    return row.style || row.publicProfile?.defaultStyle || '';
  }

  childProfileName(row: PublicContent): string {
    return row.publicProfile?.name?.trim() || this.i18n.t('No profile assigned');
  }

  childProfileAvatar(row: PublicContent): string {
    return row.publicProfile?.avatarImage?.trim() || '';
  }

  childProfileInitials(row: PublicContent): string {
    const parts = this.childProfileName(row).split(/\s+/).filter(Boolean).slice(0, 2);
    return parts.map((part) => part.charAt(0).toUpperCase()).join('') || 'P';
  }

  childTilePreview(row: PublicContent): string {
    const message = row.message?.trim();
    if (message) {
      return message;
    }

    const mediaTitle = row.multimedia?.title?.trim();
    if (mediaTitle) {
      return mediaTitle;
    }

    const mediaDescription = row.multimedia?.description?.trim();
    if (mediaDescription) {
      return mediaDescription;
    }

    if (row.multimedia?.type && row.multimedia.type !== 'undefined') {
      return this.i18n.t('Attached media: {{media}}', { media: this.mediaTypeLabel(row.multimedia.type) });
    }

    return this.i18n.t('No text content.');
  }

  childLocationLabel(row: PublicContent): string {
    if (row.contentType === 'comment') {
      if (row.externalParentMessageUuid) {
        return this.i18n.t('Reply to public comment');
      }
      const parentProfile = row.parentContent?.publicProfileName?.trim();
      const parentLocation = row.parentContent?.locationLabel?.trim();
      if (parentProfile && parentLocation) {
        return this.i18n.t('Reply to {{target}}', { target: `${parentProfile} • ${parentLocation}` });
      }
      if (parentLocation) {
        return this.i18n.t('Reply to {{target}}', { target: parentLocation });
      }
      if (parentProfile) {
        return this.i18n.t('Reply to {{target}}', { target: parentProfile });
      }
      return this.i18n.t('Comment without parent');
    }

    const label = this.normalizeLocationLabel(row.location?.label?.trim() ?? '');
    if (label) {
      return label;
    }

    const plusCode = row.location?.plusCode?.trim();
    if (plusCode) {
      return plusCode;
    }

    const latitude = Number(row.location?.latitude ?? 0);
    const longitude = Number(row.location?.longitude ?? 0);
    if (latitude !== 0 || longitude !== 0) {
      return `${this.formatCoordinate(latitude)}, ${this.formatCoordinate(longitude)}`;
    }

    return this.i18n.t('No location');
  }

  externalCommentCount(row: ExternalPublicContent): number {
    return Math.max(0, Number(row.commentsNumber ?? 0));
  }

  externalResolvedStyle(row: ExternalPublicContent): string {
    return row.style || '';
  }

  externalProfileName(row: ExternalPublicContent): string {
    return row.displayName?.trim() || this.i18n.t('Public visitor');
  }

  externalProfileAvatar(row: ExternalPublicContent): string {
    return row.avatarImage?.trim() || '';
  }

  externalProfileInitials(row: ExternalPublicContent): string {
    const parts = this.externalProfileName(row).split(/\s+/).filter(Boolean).slice(0, 2);
    return parts.map((part) => part.charAt(0).toUpperCase()).join('') || 'P';
  }

  externalTilePreview(row: ExternalPublicContent): string {
    const message = row.message?.trim();
    if (message) {
      return message;
    }

    const mediaTitle = row.multimedia?.title?.trim();
    if (mediaTitle) {
      return mediaTitle;
    }

    const mediaDescription = row.multimedia?.description?.trim();
    if (mediaDescription) {
      return mediaDescription;
    }

    if (row.multimedia?.type && row.multimedia.type !== 'undefined') {
      return this.i18n.t('Attached media: {{media}}', { media: this.mediaTypeLabel(row.multimedia.type) });
    }

    return this.i18n.t('No text content.');
  }

  externalHasImageMultimedia(row: ExternalPublicContent): boolean {
    return this.isImageMultimedia(row.multimedia);
  }

  profileAvatar(): string {
    return this.selectedProfile()?.avatarImage?.trim() || '';
  }

  profileName(): string {
    return this.selectedProfile()?.name?.trim() || this.i18n.t('No public profile selected');
  }

  profileInitials(): string {
    const parts = this.profileName().split(/\s+/).filter(Boolean).slice(0, 2);
    return parts.map((part) => part.charAt(0).toUpperCase()).join('') || 'P';
  }

  formatStatus(status: string): string {
    switch (status) {
      case 'published':
        return this.i18n.t('Published');
      case 'withdrawn':
        return this.i18n.t('Withdrawn');
      case 'deleted':
        return this.i18n.t('Deleted');
      case 'draft':
      default:
        return this.i18n.t('Draft');
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

  mediaTypeLabel(type: string | null | undefined): string {
    switch ((type ?? '').toLowerCase()) {
      case 'youtube':
        return 'YouTube';
      case 'spotify':
        return 'Spotify';
      case 'pinterest':
        return 'Pinterest';
      case 'tiktok':
        return 'TikTok';
      case 'tenor':
        return this.i18n.t('Tenor GIF');
      case 'image':
        return this.i18n.t('Image');
      case 'undefined':
      case '':
        return this.i18n.t('No media');
      default:
        return type ?? this.i18n.t('Media');
    }
  }

  typeLabel(type: PublicContentType | string): string {
    return type === 'comment' ? this.i18n.t('Comment') : this.i18n.t('Message');
  }

  typeIcon(type: PublicContentType | string): string {
    return type === 'comment' ? 'forum' : 'campaign';
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
      this.showMessage('A maximum of {{count}} hashtags is allowed.', { count: MAX_PUBLIC_HASHTAGS });
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

  openAiToolDialog(tool: AiTool): void {
    if (!this.canUseAiTools()) {
      if (!this.aiConfigured()) {
        this.showMessage('Configure the OpenAI API first before using AI tools.');
        return;
      }
      if (this.isPublished()) {
        this.showMessage('Withdraw the public message before changing it with AI tools.');
        return;
      }
      if (this.isDeleted()) {
        this.showMessage('Deleted content cannot be changed with AI tools.');
        return;
      }
      return;
    }

    if ((tool === 'proofread' || tool === 'rewrite' || tool === 'translate') && !this.hasAiTextSource()) {
      this.showMessage('Please add some message text first.');
      return;
    }

    if (tool === 'hashtags' && !this.hasAiContext()) {
      this.showMessage('Please add some text, media or context first.');
      return;
    }

    this.dialog.open<PublicContentAiDialogComponent, unknown, PublicContentAiDialogResult>(
      PublicContentAiDialogComponent,
      {
        width: 'min(92vw, 880px)',
        maxWidth: '92vw',
        maxHeight: '92vh',
        autoFocus: false,
        panelClass: 'mdp-dialog-xl',
        data: {
          tool,
          model: this.aiModelLabel(),
          text: this.formValue().message,
          contentType: this.contentType(),
          locationLabel: this.activeLocationLabel(),
          publicProfileName: this.profileName(),
          publicProfileGuidance: this.selectedProfile()?.aiGuidance ?? '',
          parentLabel: this.aiParentContextLabel(),
          existingHashtags: this.hashtags(),
          multimedia: {
            type: this.multimedia().type,
            title: this.multimedia().title,
            description: this.multimedia().description
          }
        }
      }
    ).afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (!result) {
          return;
        }
        this.applyAiDialogResult(result);
      });
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
    if (this.isCommentMode() && !this.hasSelectedParentContent()) {
      this.showMessage('Please select parent content before saving this comment.');
      return null;
    }
    if (!this.isCommentMode() && !this.hasSelectedLocation()) {
      this.showMessage('Please select a location before saving.');
      return null;
    }

    return {
      contentType: this.contentType(),
      parentContentId: this.form.controls.parentContentId.value.trim(),
      externalParentMessageUuid: this.isCommentMode()
        ? (this.selectedExternalParentUuid().trim() || this.currentContent()?.externalParentMessageUuid?.trim() || '')
        : '',
      publicProfileId: raw.publicProfileId.trim(),
      message,
      location: {
        latitude: this.isCommentMode() ? 0 : (Number(raw.location.latitude) || 0),
        longitude: this.isCommentMode() ? 0 : (Number(raw.location.longitude) || 0),
        plusCode: this.isCommentMode() ? '' : raw.location.plusCode.trim(),
        label: this.isCommentMode() ? '' : this.activeLocationLabel()
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
    this.selectedParentContent.set(null);
    this.selectedExternalParent.set(null);
    this.selectedExternalParentUuid.set(content.externalParentMessageUuid?.trim() || '');
    this.multimedia.set(content.multimedia ?? { ...EMPTY_MULTIMEDIA });
    this.hashtags.set(Array.isArray(content.hashtags) ? [...content.hashtags] : []);
    this.selectedLocationLabel.set(storedLocationLabel);
    this.locationSearchResults.set([]);
    this.locationSearchControl.setValue(this.formatStoredLocation(content));
    this.form.setValue({
      contentType: content.contentType ?? 'public',
      parentContentId: content.parentContent?.id ?? '',
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
    this.loadChildComments(content.id);
    this.loadExternalComments(content);

    if (content.externalParentMessageUuid?.trim()) {
      this.loadExternalParentContent(content.externalParentMessageUuid.trim());
    }

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

  private showMessage(message: string, params?: Record<string, unknown>): void {
    this.snackBar.open(this.i18n.t(message, params), this.i18n.t('OK'), { duration: 2800 });
  }

  private applyAiDialogResult(result: PublicContentAiDialogResult): void {
    if (result.action === 'replace_text' && result.text) {
      this.form.controls.message.setValue(result.text);
      this.showMessage('AI text applied.');
      return;
    }

    if (result.action === 'append_text' && result.text) {
      const currentText = (this.form.controls.message.value ?? '').trim();
      const nextText = currentText ? `${currentText} ${result.text}` : result.text;
      this.form.controls.message.setValue(nextText);
      this.showMessage('AI suggestion added.');
      return;
    }

    if ((result.action === 'replace_hashtags' || result.action === 'append_hashtags') && Array.isArray(result.hashtags)) {
      const mergedInput = result.action === 'replace_hashtags'
        ? result.hashtags
        : [...this.hashtags(), ...result.hashtags];
      const normalized = normalizeHashtags(mergedInput, MAX_PUBLIC_HASHTAGS);
      this.hashtags.set(normalized.tags);
      this.showMessage(result.action === 'replace_hashtags' ? 'AI hashtags applied.' : 'AI hashtags added.');
    }
  }

  private loadChildComments(parentContentId: string): void {
    const normalizedParentId = parentContentId.trim();
    if (!normalizedParentId) {
      this.childComments.set([]);
      return;
    }

    this.childCommentsLoading.set(true);
    this.publicContentService.listPublicContent({
      parentContentId: normalizedParentId,
      contentType: 'comment',
      limit: 200,
      offset: 0
    }).pipe(
      finalize(() => this.childCommentsLoading.set(false)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (rows) => this.childComments.set(rows),
      error: () => {
        this.childComments.set([]);
        this.showMessage('Comments could not be loaded.');
      }
    });
  }

  private loadExternalComments(content: PublicContent | null): void {
    if (!content || content.status !== 'published' || !content.publishedMessageUuid?.trim()) {
      this.externalComments.set([]);
      this.externalCommentsLoading.set(false);
      return;
    }

    this.externalCommentsLoading.set(true);
    this.publicContentService.getExternalCommentsForContent(content.id)
      .pipe(
        finalize(() => this.externalCommentsLoading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (rows) => this.externalComments.set(rows),
        error: () => {
          this.externalComments.set([]);
          this.showMessage('Public comments could not be loaded.');
        }
      });
  }

  private loadParentContent(id: string): void {
    this.loading.set(true);
    this.publicContentService.getPublicContent(id)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (row) => {
          this.selectedParentContent.set(row);
          this.form.controls.parentContentId.setValue(row.id);
          this.form.controls.contentType.setValue('comment');
        },
        error: () => {
          this.selectedParentContent.set(null);
          this.showMessage('Parent content could not be loaded.');
        }
      });
  }

  private loadExternalParentContent(messageUuid: string): void {
    const normalizedMessageUuid = messageUuid.trim();
    if (!normalizedMessageUuid) {
      this.selectedExternalParentUuid.set('');
      this.selectedExternalParent.set(null);
      return;
    }

    this.selectedExternalParentUuid.set(normalizedMessageUuid);
    this.publicContentService.getExternalPublicContent(normalizedMessageUuid)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (row) => {
          this.selectedExternalParent.set(row);
        },
        error: () => {
          this.selectedExternalParent.set(null);
        }
      });
  }

  private applyRouteState(contentId: string, requestedType: string, parentId: string, externalParentUuid: string): void {
    if (contentId) {
      if (this.currentContent()?.id !== contentId) {
        this.loadContent(contentId);
      }
      return;
    }

    this.prepareCreateState(requestedType, parentId, externalParentUuid);
  }

  private prepareCreateState(requestedType: string, parentId: string, externalParentUuid: string): void {
    const defaultProfileId = this.publicProfiles()[0]?.id ?? '';

    this.currentContent.set(null);
    this.selectedParentContent.set(null);
    this.selectedExternalParent.set(null);
    this.selectedExternalParentUuid.set('');
    this.childComments.set([]);
    this.childCommentsLoading.set(false);
    this.externalComments.set([]);
    this.externalCommentsLoading.set(false);
    this.multimedia.set({ ...EMPTY_MULTIMEDIA });
    this.hashtags.set([]);
    this.selectedLocationLabel.set('');
    this.locationSearchResults.set([]);
    this.previewStyleOverride.set('');

    this.form.setValue({
      contentType: requestedType === 'comment' ? 'comment' : 'public',
      parentContentId: '',
      message: '',
      style: '',
      publicProfileId: defaultProfileId,
      location: {
        latitude: 0,
        longitude: 0,
        plusCode: ''
      }
    }, { emitEvent: false });

    this.hashtagControl.setValue('', { emitEvent: false });
    this.mediaUrlControl.setValue('', { emitEvent: false });
    this.tenorControl.setValue('', { emitEvent: false });
    this.locationSearchControl.setValue('', { emitEvent: false });

    this.updateFormState();

    if (requestedType === 'comment' && parentId) {
      this.form.controls.parentContentId.setValue(parentId, { emitEvent: false });
      this.loadParentContent(parentId);
    }
    if (requestedType === 'comment' && externalParentUuid) {
      this.loadExternalParentContent(externalParentUuid);
    }
  }

  private resolveBackParentId(): string {
    const currentParentId = this.currentContent()?.parentContent?.id?.trim();
    if (currentParentId) {
      return currentParentId;
    }

    const selectedParentId = this.selectedParentContent()?.id?.trim();
    if (selectedParentId) {
      return selectedParentId;
    }

    return this.route.snapshot.queryParamMap.get('parentId')?.trim() || '';
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
