import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxChange, MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { debounceTime, distinctUntilChanged, finalize, firstValueFrom, map, of, startWith, switchMap } from 'rxjs';
import { AiToolRequest } from '../../../interfaces/ai-tool-request.interface';
import { AiContentCreatorSuggestion } from '../../../interfaces/ai-tool-result.interface';
import { Multimedia } from '../../../interfaces/multimedia.interface';
import { NominatimPlace } from '../../../interfaces/nominatim-place.interface';
import { PublicContentSavePayload } from '../../../interfaces/public-content-save-payload.interface';
import { PublicProfile } from '../../../interfaces/public-profile.interface';
import { TenorResult } from '../../../interfaces/tenor-response.interface';
import { AiService } from '../../../services/content/ai.service';
import { PublicContentService } from '../../../services/content/public-content.service';
import { NominatimService } from '../../../services/location/nominatim.service';
import { TranslationHelperService } from '../../../services/translation-helper.service';

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

const DEFAULT_CONTENT_CREATOR_COUNT = 4;
const SUGGESTION_COUNT_OPTIONS = [2, 3, 4, 5, 6];
const CONTENT_CREATOR_STYLE_OPTIONS = [
  { value: 'auto', label: 'Automatic' },
  { value: 'factual', label: 'Factual' },
  { value: 'emotional', label: 'Emotional' },
  { value: 'bold', label: 'Bold' },
  { value: 'short', label: 'Short' }
] as const;
const CONTENT_CREATOR_MESSAGE_TYPE_OPTIONS = [
  { value: 'auto', label: 'Automatic' },
  { value: 'event', label: 'Event' },
  { value: 'info', label: 'Info' },
  { value: 'reminder', label: 'Reminder' },
  { value: 'call_to_action', label: 'Call to Action' }
] as const;
const CONTENT_CREATOR_HASHTAG_STYLE_OPTIONS = [
  { value: 'auto', label: 'Automatic' },
  { value: 'minimal', label: 'Minimal' },
  { value: 'local', label: 'Local' },
  { value: 'campaign', label: 'Campaign' },
  { value: 'discoverable', label: 'Discoverable' }
] as const;

interface MultimediaPreviewState {
  url: string;
  supported: boolean;
  loading: boolean;
  multimedia: Multimedia | null;
}

type ContentCreatorStyle = typeof CONTENT_CREATOR_STYLE_OPTIONS[number]['value'];
type ContentCreatorMessageType = typeof CONTENT_CREATOR_MESSAGE_TYPE_OPTIONS[number]['value'];
type ContentCreatorHashtagStyle = typeof CONTENT_CREATOR_HASHTAG_STYLE_OPTIONS[number]['value'];

interface EditableContentCreatorSuggestion extends AiContentCreatorSuggestion {
  locationInput: string;
  selectedPlace: NominatimPlace | null;
  locationCandidates: NominatimPlace[];
  locationLoading: boolean;
  tenorInput: string;
  tenorResults: TenorResult[];
  tenorLoading: boolean;
  selectedTenor: Multimedia | null;
}

export interface PublicContentAiCreatorDialogData {
  model: string;
  publicProfiles: PublicProfile[];
  defaultPublicProfileId: string;
}

export interface PublicContentAiCreatorDialogResult {
  importedCount: number;
  failedCount: number;
  publicProfileId: string;
}

@Component({
  selector: 'app-public-content-ai-creator-dialog',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogContent,
    MatDialogActions,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTooltipModule
  ],
  templateUrl: './public-content-ai-creator-dialog.component.html',
  styleUrl: './public-content-ai-creator-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PublicContentAiCreatorDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<PublicContentAiCreatorDialogComponent, PublicContentAiCreatorDialogResult>);
  readonly data = inject<PublicContentAiCreatorDialogData>(MAT_DIALOG_DATA);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly snackBar = inject(MatSnackBar);
  private readonly aiService = inject(AiService);
  private readonly publicContentService = inject(PublicContentService);
  private readonly nominatimService = inject(NominatimService);
  readonly i18n = inject(TranslationHelperService);

  readonly loading = signal(false);
  readonly importing = signal(false);
  readonly contentUrls = signal<string[]>([]);
  readonly suggestions = signal<EditableContentCreatorSuggestion[]>([]);
  readonly selectedSuggestionIndices = signal<number[]>([]);
  readonly suggestionCountOptions = SUGGESTION_COUNT_OPTIONS;
  readonly creatorStyleOptions = CONTENT_CREATOR_STYLE_OPTIONS;
  readonly creatorMessageTypeOptions = CONTENT_CREATOR_MESSAGE_TYPE_OPTIONS;
  readonly creatorHashtagStyleOptions = CONTENT_CREATOR_HASHTAG_STYLE_OPTIONS;

  readonly form = this.fb.nonNullable.group({
    publicProfileId: this.fb.nonNullable.control(this.resolveInitialProfileId()),
    prompt: this.fb.nonNullable.control(''),
    creatorStyle: this.fb.nonNullable.control<ContentCreatorStyle>('auto'),
    creatorMessageType: this.fb.nonNullable.control<ContentCreatorMessageType>('auto'),
    creatorHashtagStyle: this.fb.nonNullable.control<ContentCreatorHashtagStyle>('auto'),
    suggestionCount: this.fb.nonNullable.control(DEFAULT_CONTENT_CREATOR_COUNT),
    multimediaUrl: this.fb.nonNullable.control(''),
    contentUrlInput: this.fb.nonNullable.control('')
  });
  private readonly formValue = toSignal(
    this.form.valueChanges.pipe(startWith(this.form.getRawValue())),
    { initialValue: this.form.getRawValue() }
  );
  private readonly multimediaPreviewState = toSignal(
    this.form.controls.multimediaUrl.valueChanges.pipe(
      startWith(this.form.controls.multimediaUrl.value),
      map((value) => this.normalizeHttpUrl(value)),
      debounceTime(250),
      distinctUntilChanged(),
      switchMap((url) => {
        const provider = this.detectSupportedMultimediaProvider(url);
        if (!url) {
          return of<MultimediaPreviewState>({
            url: '',
            supported: false,
            loading: false,
            multimedia: null
          });
        }

        if (!provider) {
          return of<MultimediaPreviewState>({
            url,
            supported: false,
            loading: false,
            multimedia: null
          });
        }

        return this.publicContentService.previewOembed(url).pipe(
          map((multimedia) => ({
            url,
            supported: true,
            loading: false,
            multimedia
          })),
          startWith({
            url,
            supported: true,
            loading: true,
            multimedia: null
          })
        );
      })
    ),
    {
      initialValue: {
        url: '',
        supported: false,
        loading: false,
        multimedia: null
      }
    }
  );

  readonly normalizedMultimediaUrl = computed(() => this.normalizeHttpUrl(this.formValue().multimediaUrl ?? ''));
  readonly multimediaProvider = computed(() => this.detectSupportedMultimediaProvider(this.normalizedMultimediaUrl()));
  readonly pendingContentUrl = computed(() => this.normalizeHttpUrl(this.formValue().contentUrlInput ?? ''));
  readonly sourceUrlsForRun = computed(() => {
    const unique = new Set(this.contentUrls());
    const pending = this.pendingContentUrl();
    if (pending) {
      unique.add(pending);
    }
    return Array.from(unique);
  });
  readonly hasPendingContentUrl = computed(() => {
    const pending = this.pendingContentUrl();
    return !!pending && !this.contentUrls().includes(pending);
  });
  readonly multimediaPreview = computed(() => this.multimediaPreviewState().multimedia);
  readonly multimediaPreviewLoading = computed(() => this.multimediaPreviewState().loading);
  readonly hasUnsupportedMultimediaUrl = computed(() => !!this.normalizedMultimediaUrl() && !this.multimediaProvider());
  readonly hasSupportedMultimediaPreviewFailure = computed(() => {
    const state = this.multimediaPreviewState();
    return !!state.url && state.supported && !state.loading && !state.multimedia;
  });
  readonly previewMessageType = computed(() => this.formValue().creatorMessageType ?? 'auto');
  readonly previewHashtagStyle = computed(() => this.formValue().creatorHashtagStyle ?? 'auto');

  readonly selectedProfile = computed(() => {
    const selectedId = this.formValue().publicProfileId ?? '';
    return this.data.publicProfiles.find((profile) => profile.id === selectedId) ?? null;
  });

  readonly canRun = computed(() => {
    if (this.loading() || this.importing()) {
      return false;
    }
    const formValue = this.formValue();
    return !!formValue.publicProfileId && !!(formValue.prompt ?? '').trim();
  });

  readonly canImport = computed(() => (
    !this.loading()
    && !this.importing()
    && this.selectedSuggestionIndices().length > 0
    && !!(this.formValue().publicProfileId ?? '')
  ));

  close(): void {
    this.dialogRef.close();
  }

  addContentUrl(): void {
    const rawValue = this.form.controls.contentUrlInput.value;
    const normalized = this.normalizeHttpUrl(rawValue);
    if (!normalized) {
      if (rawValue.trim()) {
        this.showMessage('Please enter a valid URL starting with http:// or https://.');
      }
      return;
    }

    this.contentUrls.update((current) => (
      current.includes(normalized) ? current : [...current, normalized]
    ));
    this.form.controls.contentUrlInput.setValue('');
  }

  removeContentUrl(url: string): void {
    this.contentUrls.update((current) => current.filter((entry) => entry !== url));
  }

  addContentUrlOnEnter(event: Event): void {
    event.preventDefault();
    this.addContentUrl();
  }

  run(): void {
    if (!this.canRun()) {
      return;
    }

    const contentUrlInputValue = this.form.controls.contentUrlInput.value.trim();
    if (contentUrlInputValue && !this.pendingContentUrl()) {
      this.showMessage('Please enter a valid URL starting with http:// or https://.');
      return;
    }

    const multimediaUrlValue = this.form.controls.multimediaUrl.value.trim();
    if (multimediaUrlValue && !this.normalizeHttpUrl(multimediaUrlValue)) {
      this.showMessage('Please enter a valid URL starting with http:// or https://.');
      return;
    }

    this.commitPendingContentUrl();

    this.loading.set(true);
    this.suggestions.set([]);
    this.selectedSuggestionIndices.set([]);

    this.aiService.applyTool(this.buildRequest())
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (result) => {
          const suggestions = (result.contentSuggestions ?? []).map((entry) => this.toEditableSuggestion(entry));
          this.suggestions.set(suggestions);
          if (suggestions.length === 0) {
            this.showMessage('No AI draft suggestions were returned.');
            return;
          }

          suggestions.forEach((suggestion, index) => {
            if (suggestion.tenorInput.trim() && !suggestion.multimedia) {
              void this.loadSuggestionTenor(index, false);
            }
          });
        }
      });
  }

  suggestionTrackBy(index: number): number {
    return index;
  }

  profileTrackBy(_index: number, profile: PublicProfile): string {
    return profile.id;
  }

  styleTrackBy(_index: number, option: typeof CONTENT_CREATOR_STYLE_OPTIONS[number]): string {
    return option.value;
  }

  messageTypeTrackBy(_index: number, option: typeof CONTENT_CREATOR_MESSAGE_TYPE_OPTIONS[number]): string {
    return option.value;
  }

  hashtagStyleTrackBy(_index: number, option: typeof CONTENT_CREATOR_HASHTAG_STYLE_OPTIONS[number]): string {
    return option.value;
  }

  locationCandidateTrackBy(_index: number, place: NominatimPlace): number {
    return place.place_id;
  }

  tenorResultTrackBy(_index: number, result: TenorResult): string {
    return result.id;
  }

  isSuggestionSelected(index: number): boolean {
    return this.selectedSuggestionIndices().includes(index);
  }

  toggleSuggestionSelection(index: number, event?: MatCheckboxChange): void {
    const nextChecked = event?.checked ?? !this.isSuggestionSelected(index);
    this.selectedSuggestionIndices.update((current) => {
      if (nextChecked) {
        return current.includes(index) ? current : [...current, index].sort((left, right) => left - right);
      }
      return current.filter((entry) => entry !== index);
    });
  }

  selectAllSuggestions(): void {
    this.selectedSuggestionIndices.set(this.suggestions().map((_entry, index) => index));
  }

  clearSuggestionSelection(): void {
    this.selectedSuggestionIndices.set([]);
  }

  async importSelectedSuggestions(): Promise<void> {
    if (!this.canImport()) {
      return;
    }

    const selectedProfileId = this.form.controls.publicProfileId.value;
    const selectedSuggestions = this.selectedSuggestionIndices()
      .map((index) => this.suggestions()[index] ?? null)
      .filter((entry): entry is EditableContentCreatorSuggestion => entry !== null);

    if (selectedSuggestions.length === 0) {
      return;
    }

    const locationCache = new Map<string, PublicContentSavePayload['location']>();
    const tenorCache = new Map<string, Multimedia>();
    let importedCount = 0;
    let failedCount = 0;

    this.importing.set(true);
    try {
      for (const suggestion of selectedSuggestions) {
        try {
          const payload = await this.buildDraftPayload(suggestion, selectedProfileId, locationCache, tenorCache);
          await firstValueFrom(this.publicContentService.createPublicContent(payload));
          importedCount += 1;
        } catch {
          failedCount += 1;
        }
      }
    } finally {
      this.importing.set(false);
    }

    if (importedCount === 0) {
      this.showMessage('No AI drafts could be imported.');
      return;
    }

    this.dialogRef.close({
      importedCount,
      failedCount,
      publicProfileId: selectedProfileId
    });
  }

  suggestionMediaLabel(suggestion: EditableContentCreatorSuggestion): string {
    if (suggestion.multimedia?.type && suggestion.multimedia.type !== 'undefined') {
      return this.mediaTypeLabel(suggestion.multimedia.type);
    }

    if (suggestion.selectedTenor?.type === 'tenor' || suggestion.tenorInput.trim() || suggestion.tenorQuery.trim()) {
      return this.i18n.t('Tenor GIF');
    }

    return '';
  }

  selectedProfileAvatar(): string {
    return this.selectedProfile()?.avatarImage || '';
  }

  selectedProfileInitials(): string {
    const label = this.selectedProfile()?.name?.trim() || this.i18n.t('Profile');
    return label
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || 'P';
  }

  previewLocationLabel(suggestion: EditableContentCreatorSuggestion): string {
    return suggestion.selectedPlace?.display_name
      || suggestion.selectedPlace?.name
      || suggestion.locationInput.trim()
      || suggestion.locationQuery;
  }

  previewMultimedia(suggestion: EditableContentCreatorSuggestion): Multimedia | null {
    if (suggestion.multimedia?.type && suggestion.multimedia.type !== 'undefined') {
      return suggestion.multimedia;
    }
    if (suggestion.selectedTenor?.type === 'tenor' && suggestion.selectedTenor.url) {
      return suggestion.selectedTenor;
    }
    return null;
  }

  hasImageMultimedia(multimedia: Multimedia | null | undefined): boolean {
    if (!multimedia) {
      return false;
    }
    if (multimedia.type === 'tenor' || multimedia.type === 'image') {
      return !!multimedia.url;
    }
    return /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(multimedia.url || '');
  }

  messageTypeLabel(value: ContentCreatorMessageType | string | null | undefined): string {
    switch (value) {
      case 'event':
        return this.i18n.t('Event');
      case 'info':
        return this.i18n.t('Info');
      case 'reminder':
        return this.i18n.t('Reminder');
      case 'call_to_action':
        return this.i18n.t('Call to Action');
      case 'auto':
      case '':
      case null:
      case undefined:
        return this.i18n.t('Automatic');
      default:
        return String(value);
    }
  }

  hashtagStyleLabel(value: ContentCreatorHashtagStyle | string | null | undefined): string {
    switch (value) {
      case 'minimal':
        return this.i18n.t('Minimal');
      case 'local':
        return this.i18n.t('Local');
      case 'campaign':
        return this.i18n.t('Campaign');
      case 'discoverable':
        return this.i18n.t('Discoverable');
      case 'auto':
      case '':
      case null:
      case undefined:
        return this.i18n.t('Automatic');
      default:
        return String(value);
    }
  }

  private buildRequest(): AiToolRequest {
    return {
      tool: 'content_creator',
      text: '',
      prompt: this.form.controls.prompt.value.trim(),
      creatorStyle: this.form.controls.creatorStyle.value,
      creatorMessageType: this.form.controls.creatorMessageType.value,
      creatorHashtagStyle: this.form.controls.creatorHashtagStyle.value,
      contentType: 'public',
      locationLabel: '',
      publicProfileName: this.selectedProfile()?.name ?? '',
      parentLabel: '',
      existingHashtags: [],
      contentUrls: this.sourceUrlsForRun(),
      multimediaUrl: this.normalizeHttpUrl(this.form.controls.multimediaUrl.value),
      responseLanguage: this.i18n.lang() === 'de' ? 'German' : 'English',
      suggestionCount: this.form.controls.suggestionCount.value,
      multimedia: {
        type: '',
        title: '',
        description: ''
      }
    };
  }

  onSuggestionLocationInput(index: number, event: Event): void {
    const nextValue = this.readEventInputValue(event);
    this.updateSuggestion(index, (suggestion) => ({
      ...suggestion,
      locationInput: nextValue,
      selectedPlace: null,
      locationCandidates: []
    }));
  }

  onSuggestionTenorInput(index: number, event: Event): void {
    const nextValue = this.readEventInputValue(event);
    this.updateSuggestion(index, (suggestion) => ({
      ...suggestion,
      tenorInput: nextValue,
      tenorResults: [],
      selectedTenor: null
    }));
  }

  searchSuggestionLocationsOnEnter(index: number, event: Event): void {
    event.preventDefault();
    void this.searchSuggestionLocations(index);
  }

  searchSuggestionTenorOnEnter(index: number, event: Event): void {
    event.preventDefault();
    void this.loadSuggestionTenor(index);
  }

  async searchSuggestionLocations(index: number): Promise<void> {
    const suggestion = this.suggestions()[index];
    if (!suggestion) {
      return;
    }

    const query = suggestion.locationInput.trim();
    if (!query) {
      this.showMessage('Please enter a location query first.');
      return;
    }

    this.updateSuggestion(index, (current) => ({
      ...current,
      locationLoading: true,
      selectedPlace: null,
      locationCandidates: []
    }));

    try {
      const candidates = await firstValueFrom(this.nominatimService.searchPlaces(query, 5));
      this.updateSuggestion(index, (current) => ({
        ...current,
        locationLoading: false,
        locationCandidates: candidates
      }));

      if (candidates.length === 0) {
        this.showMessage('No matching places found.');
      }
    } catch {
      this.updateSuggestion(index, (current) => ({
        ...current,
        locationLoading: false,
        locationCandidates: []
      }));
    }
  }

  selectSuggestionLocationCandidate(index: number, place: NominatimPlace): void {
    this.updateSuggestion(index, (suggestion) => ({
      ...suggestion,
      locationInput: place.display_name || place.name || suggestion.locationInput,
      selectedPlace: place,
      locationCandidates: []
    }));
  }

  clearSuggestionLocationSelection(index: number): void {
    this.updateSuggestion(index, (suggestion) => ({
      ...suggestion,
      selectedPlace: null,
      locationCandidates: []
    }));
  }

  async loadSuggestionTenor(index: number, showEmptyMessage = true): Promise<void> {
    const suggestion = this.suggestions()[index];
    if (!suggestion || suggestion.multimedia) {
      return;
    }

    const term = suggestion.tenorInput.trim();
    this.updateSuggestion(index, (current) => ({
      ...current,
      tenorLoading: true
    }));

    try {
      const response = term
        ? await firstValueFrom(this.publicContentService.searchTenor(term))
        : await firstValueFrom(this.publicContentService.getFeaturedTenor());
      const results = response.data?.results ?? [];

      this.updateSuggestion(index, (current) => ({
        ...current,
        tenorLoading: false,
        tenorResults: results
      }));

      if (showEmptyMessage && results.length === 0) {
        this.showMessage('No Tenor results were found.');
      }
    } catch {
      this.updateSuggestion(index, (current) => ({
        ...current,
        tenorLoading: false,
        tenorResults: []
      }));
    }
  }

  selectSuggestionTenorResult(index: number, result: TenorResult): void {
    this.updateSuggestion(index, (suggestion) => ({
      ...suggestion,
      selectedTenor: this.toTenorMultimedia(result)
    }));
  }

  clearSuggestionTenorSelection(index: number): void {
    this.updateSuggestion(index, (suggestion) => ({
      ...suggestion,
      selectedTenor: null
    }));
  }

  isTenorResultSelected(suggestion: EditableContentCreatorSuggestion, result: TenorResult): boolean {
    return suggestion.selectedTenor?.url === result.media_formats.gif.url;
  }

  private resolveInitialProfileId(): string {
    const preferred = this.data.defaultPublicProfileId?.trim();
    if (preferred && this.data.publicProfiles.some((profile) => profile.id === preferred)) {
      return preferred;
    }
    return this.data.publicProfiles[0]?.id ?? '';
  }

  private normalizeHttpUrl(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) {
      return '';
    }

    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return '';
      }
      parsed.hash = '';
      return parsed.toString();
    } catch {
      return '';
    }
  }

  private commitPendingContentUrl(): void {
    const pending = this.pendingContentUrl();
    if (!pending || this.contentUrls().includes(pending)) {
      return;
    }

    this.contentUrls.update((current) => [...current, pending]);
    this.form.controls.contentUrlInput.setValue('');
  }

  private detectSupportedMultimediaProvider(url: string): string {
    if (!url) {
      return '';
    }

    try {
      const hostname = new URL(url).hostname.toLowerCase();
      if (hostname === 'youtu.be' || hostname === 'youtube.com' || hostname === 'www.youtube.com' || hostname.endsWith('.youtube.com')) {
        return 'youtube';
      }
      if (hostname === 'open.spotify.com' || hostname.endsWith('.spotify.com')) {
        return 'spotify';
      }
      if (hostname === 'pinterest.com' || hostname === 'www.pinterest.com' || hostname.endsWith('.pinterest.com') || hostname === 'pin.it') {
        return 'pinterest';
      }
      if (hostname === 'tiktok.com' || hostname === 'www.tiktok.com' || hostname.endsWith('.tiktok.com') || hostname === 'vm.tiktok.com') {
        return 'tiktok';
      }
    } catch {
      return '';
    }

    return '';
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

  private toEditableSuggestion(suggestion: AiContentCreatorSuggestion): EditableContentCreatorSuggestion {
    return {
      ...suggestion,
      locationInput: suggestion.locationQuery,
      selectedPlace: null,
      locationCandidates: [],
      locationLoading: false,
      tenorInput: suggestion.tenorQuery,
      tenorResults: [],
      tenorLoading: false,
      selectedTenor: null
    };
  }

  private async buildDraftPayload(
    suggestion: EditableContentCreatorSuggestion,
    publicProfileId: string,
    locationCache: Map<string, PublicContentSavePayload['location']>,
    tenorCache: Map<string, Multimedia>
  ): Promise<PublicContentSavePayload> {
    const location = suggestion.selectedPlace
      ? this.toDraftLocation(suggestion.selectedPlace)
      : await this.resolveLocation(suggestion.locationInput, locationCache);
    const multimedia = await this.resolveSuggestedMultimedia(suggestion, tenorCache);

    return {
      contentType: 'public',
      parentContentId: '',
      externalParentMessageUuid: '',
      publicProfileId,
      message: suggestion.message,
      location,
      markerType: 'default',
      style: '',
      hashtags: suggestion.hashtags,
      multimedia
    };
  }

  private async resolveLocation(
    query: string,
    cache: Map<string, PublicContentSavePayload['location']>
  ): Promise<PublicContentSavePayload['location']> {
    const normalizedQuery = query.trim();
    const cached = cache.get(normalizedQuery);
    if (cached) {
      return cached;
    }

    const results = await firstValueFrom(this.nominatimService.searchPlaces(normalizedQuery, 1));
    const bestMatch = results[0];
    if (!bestMatch) {
      throw new Error('location_unresolved');
    }

    const location = this.toDraftLocation(bestMatch);
    cache.set(normalizedQuery, location);
    return location;
  }

  private toDraftLocation(place: NominatimPlace): PublicContentSavePayload['location'] {
    return {
      latitude: Number(place.lat) || 0,
      longitude: Number(place.lon) || 0,
      plusCode: '',
      label: place.display_name || place.name || ''
    };
  }

  private async resolveSuggestedMultimedia(
    suggestion: EditableContentCreatorSuggestion,
    cache: Map<string, Multimedia>
  ): Promise<Multimedia> {
    if (suggestion.multimedia?.type && suggestion.multimedia.type !== 'undefined') {
      return suggestion.multimedia;
    }

    if (suggestion.selectedTenor?.type === 'tenor' && suggestion.selectedTenor.url) {
      return suggestion.selectedTenor;
    }

    const normalizedTenorQuery = suggestion.tenorInput.trim() || suggestion.tenorQuery.trim();
    if (!normalizedTenorQuery) {
      return { ...EMPTY_MULTIMEDIA };
    }

    const cached = cache.get(normalizedTenorQuery);
    if (cached) {
      return cached;
    }

    try {
      const response = await firstValueFrom(this.publicContentService.searchTenor(normalizedTenorQuery));
      const match = response.data?.results?.[0];
      if (!match) {
        return { ...EMPTY_MULTIMEDIA };
      }

      const multimedia = this.toTenorMultimedia(match);
      cache.set(normalizedTenorQuery, multimedia);
      return multimedia;
    } catch {
      return { ...EMPTY_MULTIMEDIA };
    }
  }

  private toTenorMultimedia(result: TenorResult): Multimedia {
    return {
      type: 'tenor',
      url: result.media_formats.gif.url,
      sourceUrl: result.itemurl,
      attribution: 'Powered by Tenor',
      title: result.title,
      description: result.content_description,
      contentId: '',
      oembed: null
    };
  }

  private updateSuggestion(
    index: number,
    updater: (suggestion: EditableContentCreatorSuggestion) => EditableContentCreatorSuggestion
  ): void {
    this.suggestions.update((current) => current.map((suggestion, currentIndex) => (
      currentIndex === index ? updater(suggestion) : suggestion
    )));
  }

  private readEventInputValue(event: Event): string {
    const target = event.target;
    return target instanceof HTMLInputElement ? target.value : '';
  }

  private showMessage(message: string, params?: Record<string, unknown>): void {
    this.snackBar.open(this.i18n.t(message, params), this.i18n.t('OK'), {
      duration: 3000,
      panelClass: ['snack-info'],
      horizontalPosition: 'center',
      verticalPosition: 'top'
    });
  }
}
