
import { AfterViewInit, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, QueryList, ViewChild, ViewChildren, computed, effect, inject, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoPipe } from '@jsverse/transloco';
import { Contact } from '../../interfaces/contact';
import { Location } from '../../interfaces/location';
import { Mode } from '../../interfaces/mode';
import { MultimediaType } from '../../interfaces/multimedia-type';
import { ShortMessage } from '../../interfaces/short-message';
import { ExperienceResult } from '../../interfaces/viator';
import { ContactMessageService } from '../../services/contact-message.service';
import { ContactService } from '../../services/contact.service';
import { LanguageService } from '../../services/language.service';
import { MapService } from '../../services/map.service';
import { SocketioService } from '../../services/socketio.service';
import { TranslateService } from '../../services/translate.service';
import { TranslationHelperService } from '../../services/translation-helper.service';
import { UserService } from '../../services/user.service';
import { ContactEditMessageComponent } from '../contact/contact-edit-message/contact-edit-message.component';
import { ContactSettingsComponent } from '../contact/contact-setting/contact-settings.component';
import { ShowmultimediaComponent } from '../multimedia/showmultimedia/showmultimedia.component';
import { ShowmessageComponent } from '../showmessage/showmessage.component';
import { UserProfileComponent } from '../user/user-profile/user-profile.component';
import { EmoticonPickerComponent } from '../utils/emoticon-picker/emoticon-picker.component';
import { HelpDialogService } from '../utils/help-dialog/help-dialog.service';
import { AudioRecorderComponent } from '../utils/audio-recorder/audio-recorder.component';
import { LocationPickerDialogComponent } from '../utils/location-picker-dialog/location-picker-dialog.component';
import { LocationPreviewComponent } from '../utils/location-preview/location-preview.component';
import { ExperienceSearchComponent } from '../utils/experience-search/experience-search.component';
import { ExperienceSearchDetailDialogComponent } from '../utils/experience-search/detail-dialog/experience-search-detail-dialog.component';
import { DeleteContactMessageComponent } from './delete-contact-message/delete-contact-message.component';

interface ChatroomMessage {
  id: string;
  messageId: string;
  direction: 'user' | 'contactUser';
  payload: ShortMessage | null;
  createdAt: string;
  readAt?: string | null;
  status?: string;
  reaction?: string | null;
  showOriginal?: boolean;
}

@Component({
  selector: 'app-contact-chatroom',
  imports: [
    MatCardModule,
    MatButtonModule,
    MatDialogActions,
    MatDialogTitle,
    MatIcon,
    ShowmultimediaComponent,
    ShowmessageComponent,
    LocationPreviewComponent,
    TranslocoPipe
  ],
  templateUrl: './contact-chatroom.component.html',
  styleUrl: './contact-chatroom.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ContactChatroomComponent implements AfterViewInit {
  readonly Math = Math;
  private readonly userService = inject(UserService);
  private readonly socketioService = inject(SocketioService);
  private readonly contactService = inject(ContactService);
  private readonly mapService = inject(MapService);
  readonly help = inject(HelpDialogService);
  private readonly contactMessageService = inject(ContactMessageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly matDialog = inject(MatDialog);
  private readonly dialogRef = inject(MatDialogRef<ContactChatroomComponent>);
  private readonly contactId = inject<string>(MAT_DIALOG_DATA);
  private readonly translateService = inject(TranslateService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translation = inject(TranslationHelperService);
  private readonly languageService = inject(LanguageService);

  @ViewChild('messageScroll') private messageScroll?: ElementRef<HTMLElement>;
  @ViewChildren('messageRow') private messageRows?: QueryList<ElementRef<HTMLElement>>;

  readonly contact = computed(() =>
    this.contactService.sortedContactsSignal().find(contact => contact.id === this.contactId)
  );
  readonly profile = computed(() => {
    this.userService.profileVersion();
    return this.userService.getProfile();
  });
  readonly composeMessage = output<Contact>();
  readonly messages = signal<ChatroomMessage[]>([]);
  readonly loading = signal<boolean>(false);
  readonly loaded = signal<boolean>(false);
  readonly translationTargetLabel = computed(() =>
    this.translation.t(`common.languageNames.${this.languageService.effectiveLanguage()}`)
  );
  private readonly messageKeys = new Set<string>();
  private scrolledToFirstUnread = false;
  private readTrackingEnabled = false;
  private visibilityObserver?: IntersectionObserver;
  private currentContactId?: string;
  private lastLiveMessageId?: string;
  private lastResetToken?: number;
  private readonly audioUrlCache = new Map<string, string>();
  private audioPlayer?: HTMLAudioElement;
  private playingMessageId?: string;
  private playbackTimer?: ReturnType<typeof setInterval>;
  private readonly audioProgress = signal<Record<string, number>>({});
  private readonly maxEncryptedMessageBytes = 1_500_000;
  private readonly maxRequestBytes = 2_000_000;
  private readonly maxPerMessageBytes = Math.min(this.maxEncryptedMessageBytes, Math.floor(this.maxRequestBytes * 0.45));
  private readonly maxAudioBase64Bytes = Math.floor(this.maxPerMessageBytes / 4.3);
  readonly reactions: readonly string[] = [
    // faces/emotions
    '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '🙂', '😉', '😎',
    '😍', '😘', '🤗', '😇', '🤩', '🤔', '🤨', '😐', '😑', '😶', '🙄', '😏',
    '😢', '😭', '😡', '🤯', '🤮', '😴', '🤒', '🤧', '🤕', '😮', '😤', '🥳',
    // food
    '🍎', '🍔', '🍕', '🍣', '🍪', '🥐', '🍉', '🍌', '🍇', '🍓', '🍍', '🥑',
    '🌭', '🍟', '🌮', '🌯', '🥗', '🍜', '🍝', '🍱', '🍤', '🍥', '🍩', '🍦',
    '🍰', '🧀', '🥚', '🥞', '🥪', '🥙', '🍗', '🥩', '🍲', '🍛', '☕', '🍺',
    // travel/places
    '🏖️', '✈️', '🚗', '🚲', '🏠', '🎡', '🚂', '🚌', '🚢', '🛳️', '🚀', '🗺️', '⛺', '🏕️', '🏰', '🗽', '🏔️', '🌋',
    // sport
    '⚽', '🏀', '🎾', '🏓', '🏋️', '🚴', '🏈', '⚾', '🏐', '🏉', '🥎', '⛳', '⛸️', '🎳', '🥊', '🥋', '🏹', '🛼',
    // animals
    '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐧', '🐦', '🦉', '🦆', '🦄',
    // nature
    '☀️', '🌤️', '⛈️', '❄️', '🌈', '🌙', '⭐', '🔥', '💧', '🌊', '🌲', '🌵', '🌻', '🌷', '🍂',
    // party/symbols
    '🎉', '🎊', '🎁', '🎂', '🎈', '🥂', '🍾', '🎵', '🎶', '🎤', '🎸', '🎧', '🎬', '🪩',
    // love
    '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '💑', '💏', '😘', '😗', '😙', '😚',
    // hands/gestures
    '👍', '👎', '🙏', '👏', '🙌', '🤝', '🤜', '🤛', '✊', '👊', '🤟', '🤘', '🤞', '🤙', '🖖',
    // misc/symbols
    '💤', '💯', '✅', '❌', '❗', '❓', '🔔', '🚫', '⚠️', '♻️',
    // flags
    '🏁', '🇩🇪', '🇦🇹', '🇨🇭', '🇫🇷', '🇪🇸', '🇮🇹', '🇬🇧', '🇺🇸', '🇨🇦', '🇧🇷', '🇯🇵', '🇨🇳', '🇰🇷', '🇮🇳',
    '🇦🇺', '🇳🇿', '🇸🇪', '🇳🇴', '🇫🇮', '🇳🇱', '🇧🇪', '🇨🇿', '🇵🇱', '🇵🇹', '🇬🇷', '🇷🇺', '🇲🇽', '🇦🇷'
  ];

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.audioUrlCache.forEach((url) => URL.revokeObjectURL(url));
      this.audioUrlCache.clear();
      this.audioPlayer?.pause();
      this.audioPlayer = undefined;
      this.playingMessageId = undefined;
    });
  }

  getChatBackgroundImage(contact: Contact): string {
    return contact.chatBackgroundImage ? `url(${contact.chatBackgroundImage})` : 'none';
  }

  getChatBackgroundOpacity(contact: Contact): number {
    const transparency = contact.chatBackgroundTransparency ?? 40;
    const clamped = Math.min(Math.max(transparency, 0), 100);
    return 1 - clamped / 100;
  }

  private readonly liveMessagesEffect = effect(async () => {
    const incoming = this.contactMessageService.liveMessages();
    const contact = this.contact();
    if (!incoming || !contact || incoming.contactId !== contact.id) {
      return;
    }
    const key = this.buildMessageKey(incoming.id, incoming.signature, incoming.message);
    const payload = await this.contactMessageService.decryptAndVerify(contact, incoming);
    if (!this.messageKeys.has(key)) {
      this.messageKeys.add(key);
      this.messages.update(msgs => [{
        id: incoming.id,
        messageId: incoming.messageId,
        direction: incoming.direction,
        payload,
        createdAt: incoming.createdAt,
        readAt: incoming.readAt,
        status: incoming.status,
        reaction: incoming.reaction,
        showOriginal: false
      }, ...msgs]);
      this.lastLiveMessageId = incoming.id;
      queueMicrotask(() => this.scrollToTopIfNeeded());
    }
  });

  private readonly loadMessagesEffect = effect(() => {
    const contact = this.contact();
    if (contact && !this.loaded()) {
      this.loadMessages();
    }
  });

  private readonly observeUnreadEffect = effect(() => {
    void this.messages();
    if (!this.readTrackingEnabled) {
      return;
    }
    setTimeout(() => this.observeUnread(), 0);
  });

  private readonly updatedMessagesEffect = effect(() => {
    const updated = this.contactMessageService.updatedMessages();
    if (!updated) {
      return;
    }
    this.messages.update((msgs) =>
      msgs.map((msg) =>
        msg.messageId === updated.messageId
          ? {
            ...msg,
            status: updated.status ?? msg.status,
            readAt: updated.status === 'read' ? (msg.readAt ?? new Date().toISOString()) : msg.readAt
          }
          : msg
      )
    );
    this.contactMessageService.updatedMessages.set(null);
  });

  private readonly reactionEffect = effect(() => {
    const update = this.contactMessageService.reactionUpdate();
    if (!update) {
      return;
    }
    this.messages.update((msgs) =>
      msgs.map((msg) =>
        msg.messageId === update.messageId
          ? { ...msg, reaction: update.reaction }
          : msg
      )
    );
    this.contactMessageService.reactionUpdate.set(null);
  });

  private readonly deletedMessagesEffect = effect(() => {
    const deleted = this.contactMessageService.deletedMessage();
    if (!deleted) {
      return;
    }
    const contact = deleted.contactId ? this.contactService.sortedContactsSignal().find((c) => c.id === deleted.contactId) : this.contact();
    let removed = false;
    if (deleted.remove) {
      this.messages.update((msgs) => {
        const next = msgs.filter((msg) => msg.messageId !== deleted.messageId);
        removed = next.length !== msgs.length;
        return next;
      });
    } else {
      this.messages.update((msgs) => {
        let changed = false;
        const next = msgs.map((msg) => {
          if (msg.messageId === deleted.messageId) {
            changed = true;
            return { ...msg, status: 'deleted' };
          }
          return msg;
        });
        removed = changed;
        return next;
      });
    }
    if (removed && contact) {
      this.contactMessageService.emitUnreadCountUpdate(contact.id);
    }
    this.contactMessageService.deletedMessage.set(null);
  });

  private readonly resetMessagesEffect = effect(() => {
    const reset = this.contactService.contactReset();
    const contact = this.contact();
    if (!reset || !contact) {
      return;
    }
    if (reset.token === this.lastResetToken) {
      return;
    }
    if (reset.scope === 'all' || reset.contactUserId === contact.contactUserId) {
      this.lastResetToken = reset.token;
      this.loadMessages(true);
    }
  });

  ngAfterViewInit(): void {
    this.contactMessageService.initLiveReceive();
    this.loadMessages(true);
    this.messageRows?.changes
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (!this.scrolledToFirstUnread && this.loaded()) {
          setTimeout(() => this.scrollToFirstUnread(), 0);
          return;
        }
        if (this.readTrackingEnabled) {
          setTimeout(() => this.observeUnread(), 0);
        }
      });
  }

  canCompose(): boolean {
    return this.socketioService.isReady();
  }

  closeChatroom(): void {
    this.dialogRef.close();
  }

  openUserProfile(): void {
    const dialogRef = this.matDialog.open(UserProfileComponent, {
      data: {},
      closeOnNavigation: true,
      maxHeight: '90vh',
      maxWidth: '90vw',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: false
    });

    dialogRef.afterClosed().subscribe(() => {
      this.userService.saveProfile();
    });
  }

  openContactSettings(contact: Contact): void {
    const dialogRef = this.matDialog.open(ContactSettingsComponent, {
      data: { contact },
      closeOnNavigation: true,
      maxHeight: '90vh',
      maxWidth: '90vw',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: false
    });

    dialogRef.afterClosed().subscribe(() => {
      this.contactService.updateContactName(contact);
      this.contactService.saveAditionalContactInfos();
    });
  }

  requestCompose(): void {
    const currentContact = this.contact();
    if (!currentContact) {
      return;
    }
    const dialogRef = this.matDialog.open(ContactEditMessageComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: { mode: Mode.ADD_SHORT_MESSAGE, contact: currentContact, shortMessage: { ...this.createEmptyMessage() } },
      minWidth: '20vw',
      maxWidth: '90vw',
      maxHeight: '90vh',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: false
    });

    dialogRef.afterClosed().subscribe((result?: { shortMessage: ShortMessage }) => {
      if (!result?.shortMessage) {
        return;
      }
      void this.sendAsNewMessage(currentContact, result.shortMessage);
    });
  }

  openExperienceSearch(): void {
    const dialogRef = this.matDialog.open(ExperienceSearchComponent, {
      data: { source: 'chat' },
      panelClass: '',
      closeOnNavigation: true,
      minWidth: 'min(450px, 95vw)',
      width: '90vw',
      maxWidth: '90vw',
      height: '90vh',
      maxHeight: '90vh',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: false
    });

    const subscription = dialogRef.componentInstance.selected.subscribe((result) => {
      const contact = this.contact();
      if (contact) {
        const payload = this.createEmptyMessage();
        payload.experience = result;
        payload.experienceSearchTerm = dialogRef.componentInstance.getChatSearchTerm();
        void this.sendAsNewMessage(contact, payload);
      }
      dialogRef.close(result);
    });

    dialogRef.afterClosed().subscribe(() => subscription.unsubscribe());
  }

  openLocationPicker(): void {
    const contact = this.contact();
    if (!contact) {
      return;
    }
    const dialogRef = this.matDialog.open(LocationPickerDialogComponent, {
      data: { location: this.mapService.getMapLocation(), markerType: 'message' },
      maxWidth: '95vw',
      maxHeight: '95vh',
      width: '95vw',
      height: '95vh',
      autoFocus: false,
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false
    });

    dialogRef.afterClosed().subscribe((location?: Location) => {
      if (!location) {
        return;
      }
      const payload = this.createEmptyMessage();
      payload.location = { ...location };
      void this.sendAsNewMessage(contact, payload);
    });
  }

  openAudioRecorder(initialAudio?: ShortMessage['audio'] | null): void {
    const contact = this.contact();
    if (!contact) {
      return;
    }
    const dialogRef = this.matDialog.open(AudioRecorderComponent, {
      data: { initialAudio, maxBase64Bytes: this.maxAudioBase64Bytes },
      closeOnNavigation: true,
      minWidth: 'min(360px, 95vw)',
      maxWidth: '90vw',
      maxHeight: '90vh',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: false
    });

    dialogRef.afterClosed().subscribe((result?: { audio?: ShortMessage['audio'] }) => {
      if (!result?.audio) {
        return;
      }
      const payload = this.createEmptyMessage();
      payload.audio = result.audio;
      void this.sendAsNewMessage(contact, payload);
    });
  }

  hasContent(message?: ShortMessage): boolean {
    return !!message && (
      message.message?.trim() !== ''
      || message.multimedia?.type !== 'undefined'
      || !!message.location
      || !!message.experience
      || !!message.audio
    );
  }

  isUnread(message: { direction: 'user' | 'contactUser'; readAt?: string | null }): boolean {
    return message.direction === 'contactUser' && !message.readAt;
  }

  getDisplayedMessage(message: ChatroomMessage): string {
    const payload = message.payload;
    if (!payload) {
      return '';
    }
    if (message.direction === 'contactUser' && payload.translatedMessage && !message.showOriginal) {
      return payload.translatedMessage;
    }
    return payload.message;
  }

  getAudioUrl(message: ChatroomMessage): string | null {
    const audio = message.payload?.audio;
    if (!audio?.base64 || !audio.mimeType) {
      return null;
    }
    const cacheKey = message.messageId || message.id;
    const cached = this.audioUrlCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    const blob = this.base64ToBlob(audio.base64, audio.mimeType);
    const url = URL.createObjectURL(blob);
    this.audioUrlCache.set(cacheKey, url);
    return url;
  }

  toggleAudioPlayback(message: ChatroomMessage): void {
    const url = this.getAudioUrl(message);
    if (!url) {
      return;
    }
    const messageId = message.messageId || message.id;
    if (this.audioPlayer && this.playingMessageId && this.playingMessageId !== messageId) {
      this.audioPlayer.pause();
    }
    if (!this.audioPlayer || this.playingMessageId !== messageId) {
      this.audioPlayer = new Audio(url);
      this.playingMessageId = messageId;
      this.audioPlayer.addEventListener('ended', () => {
        this.playingMessageId = undefined;
        this.stopPlaybackProgress();
        this.setAudioProgress(messageId, 0);
      });
    }
    if (this.audioPlayer.paused) {
      void this.audioPlayer.play();
      this.startPlaybackProgress(messageId);
    } else {
      this.audioPlayer.pause();
      this.stopPlaybackProgress();
    }
  }

  isAudioPlaying(message: ChatroomMessage): boolean {
    const messageId = message.messageId || message.id;
    return this.playingMessageId === messageId && !!this.audioPlayer && !this.audioPlayer.paused;
  }

  isAudioBarActive(message: ChatroomMessage, index: number): boolean {
    const messageId = message.messageId || message.id;
    const progress = this.audioProgress()[messageId] ?? 0;
    const totalBars = message.payload?.audio?.waveform?.length ?? 0;
    if (!totalBars) {
      return false;
    }
    const activeIndex = Math.floor(progress * totalBars);
    return index <= activeIndex;
  }

  formatAudioDuration(durationMs?: number): string {
    if (!durationMs || durationMs <= 0) {
      return '';
    }
    const totalSeconds = Math.round(durationMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  waveHeight(value: number): number {
    if (!Number.isFinite(value)) {
      return 20;
    }
    return Math.max(20, Math.round(value * 100));
  }

  private startPlaybackProgress(messageId: string): void {
    this.stopPlaybackProgress();
    this.playbackTimer = setInterval(() => {
      if (!this.audioPlayer || !this.playingMessageId || this.playingMessageId !== messageId) {
        this.stopPlaybackProgress();
        return;
      }
      const duration = this.audioPlayer.duration;
      if (!Number.isFinite(duration) || duration <= 0) {
        return;
      }
      const progress = Math.min(1, Math.max(0, this.audioPlayer.currentTime / duration));
      this.setAudioProgress(messageId, progress);
    }, 120);
  }

  private stopPlaybackProgress(): void {
    if (this.playbackTimer) {
      clearInterval(this.playbackTimer);
      this.playbackTimer = undefined;
    }
  }

  private setAudioProgress(messageId: string, progress: number): void {
    this.audioProgress.update((map) => ({ ...map, [messageId]: progress }));
  }

  showOriginalMessage(message: ChatroomMessage): void {
    if (message.direction !== 'contactUser' || !message.payload?.translatedMessage) {
      return;
    }
    this.setShowOriginal(message.messageId, true);
  }

  translateMessage(message: ChatroomMessage): void {
    if (message.direction !== 'contactUser') {
      return;
    }
    const text = message.payload?.message?.trim();
    if (!text) {
      return;
    }
    if (message.payload?.translatedMessage) {
      this.setShowOriginal(message.messageId, false);
      return;
    }
    this.translateService.translate(text, this.languageService.effectiveLanguage()).subscribe({
      next: (response) => {
        if (response.status !== 200) {
          return;
        }
        const translated = response.result?.text?.trim();
        if (!translated) {
          return;
        }
        this.messages.update((msgs) =>
          msgs.map((msg) =>
            msg.messageId === message.messageId
              ? {
                ...msg,
                payload: msg.payload ? { ...msg.payload, translatedMessage: translated } : msg.payload,
                showOriginal: false
              }
              : msg
          )
        );
        void this.persistTranslation(message.messageId, translated);
      },
      error: (err) => {
        const errorMessage = err?.error?.error ?? this.translation.t('common.contact.chatroom.translateFailed');
        this.snackBar.open(errorMessage, '', { duration: 3000 });
      }
    });
  }

  openLocationInMaps(location: Location): void {
    const query = location.plusCode?.trim()
      ? location.plusCode.trim()
      : `${location.latitude},${location.longitude}`;
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    window.open(url, '_blank');
  }

  jumpToLocation(location: Location): void {
    this.mapService.moveToWithZoom(location, 18);
    this.matDialog.getDialogById('contactListDialog')?.close();
    this.dialogRef.close();
  }

  openExperienceDetails(result: ExperienceResult): void {
    this.matDialog.open(ExperienceSearchDetailDialogComponent, {
      data: { result },
      autoFocus: false,
      backdropClass: 'dialog-backdrop',
      maxWidth: '95vw',
      maxHeight: '95vh'
    });
  }

  getExperienceTitle(result: ExperienceResult): string {
    return result.title || result.productCode || '';
  }

  getExperienceDuration(result: ExperienceResult): string {
    return result.duration || '';
  }

  getExperiencePriceLabel(result: ExperienceResult): string {
    if (result.priceFrom === undefined || result.priceFrom === null) {
      return '';
    }
    const currency = result.currency || 'EUR';
    const locale = this.languageService.effectiveLanguage() || 'en';
    try {
      return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(result.priceFrom);
    } catch {
      return `${result.priceFrom} ${currency}`;
    }
  }

  getExperienceImage(result: ExperienceResult): string | null {
    return result.imageUrl || result.avatarUrl || null;
  }

  editMessage(message: ChatroomMessage): void {
    const contact = this.contact();
    if (!contact || message.direction !== 'user') {
      return;
    }
    if (message.payload?.audio) {
      this.openAudioRecorder(message.payload.audio);
      return;
    }
    if (message.payload?.experience) {
      const initialTerm = message.payload.experienceSearchTerm
        || message.payload.experience.title
        || message.payload.experience.productCode
        || '';
      const dialogRef = this.matDialog.open(ExperienceSearchComponent, {
        data: { source: 'chat', initialTerm, autoSearch: true },
        panelClass: '',
        closeOnNavigation: true,
        minWidth: 'min(450px, 95vw)',
        width: '90vw',
        maxWidth: '90vw',
        height: '90vh',
        maxHeight: '90vh',
        hasBackdrop: true,
        backdropClass: 'dialog-backdrop',
        disableClose: false,
        autoFocus: false
      });

      const subscription = dialogRef.componentInstance.selected.subscribe((result) => {
        const payload = this.createEmptyMessage();
        payload.experience = result;
        payload.experienceSearchTerm = dialogRef.componentInstance.getChatSearchTerm();
        void this.sendAsNewMessage(contact, payload);
        dialogRef.close(result);
      });

      dialogRef.afterClosed().subscribe(() => subscription.unsubscribe());
      return;
    }
    if (message.payload?.location) {
      const dialogRef = this.matDialog.open(LocationPickerDialogComponent, {
        data: { location: { ...message.payload.location }, markerType: 'message' },
        maxWidth: '95vw',
        maxHeight: '95vh',
        width: '95vw',
        height: '95vh',
        autoFocus: false,
        hasBackdrop: true,
        backdropClass: 'dialog-backdrop',
        disableClose: false
      });

      dialogRef.afterClosed().subscribe((location?: Location) => {
        if (!location) {
          return;
        }
        const payload: ShortMessage = message.payload ? { ...message.payload, location: { ...location } } : {
          ...this.createEmptyMessage(),
          location: { ...location }
        };
        void this.sendAsNewMessage(contact, payload);
      });
      return;
    }
    const initialPayload: ShortMessage = message.payload
      ? { ...message.payload }
      : this.createEmptyMessage();

    const dialogRef = this.matDialog.open(ContactEditMessageComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: { mode: Mode.EDIT_SHORT_MESSAGE, contact, shortMessage: { ...initialPayload } },
      minWidth: '20vw',
      maxWidth: '90vw',
      maxHeight: '90vh',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: false
    });

    dialogRef.afterClosed().subscribe((result?: { shortMessage: ShortMessage }) => {
      if (!result?.shortMessage) {
        return;
      }
      void this.sendAsNewMessage(contact, result.shortMessage);
    });
  }

  deleteMessage(_message: ChatroomMessage): void {
    const contact = this.contact();
    if (!contact) {
      return;
    }
    const dialogRef = this.matDialog.open(DeleteContactMessageComponent, {
      closeOnNavigation: true,
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: false
    });

    dialogRef.afterClosed().subscribe((confirm?: boolean) => {
      if (!confirm) {
        return;
      }
      const scope = _message.direction === 'user' ? 'both' : 'single';
      this.contactMessageService.deleteMessage({
        messageId: _message.messageId,
        contactId: contact.id,
        scope,
        userId: contact.userId,
        contactUserId: contact.contactUserId
      }).subscribe({
        next: () => {
          this.messages.update((msgs) => msgs.filter((msg) => msg.messageId !== _message.messageId));
          this.contactMessageService.emitUnreadCountUpdate(contact.id);
          const remove = scope === 'both';
          if (scope === 'both' || scope === 'single') {
            this.socketioService.sendDeletedContactMessage({
              contactId: contact.id,
              userId: contact.userId,
              contactUserId: contact.contactUserId,
              messageId: _message.messageId,
              remove
            });
          }
        }
      });
    });
  }

  addOptimisticMessage(message: ShortMessage): string | undefined {
    const contact = this.contact();
    if (!contact) {
      return undefined;
    }
    const now = new Date().toISOString();
    const messageId = crypto.randomUUID();
    this.messages.update((msgs) => [{
      id: `local-${messageId}`,
      messageId,
      direction: 'user',
      payload: message,
      createdAt: now,
      status: 'sent'
    }, ...msgs]);
    queueMicrotask(() => this.scrollToTop());
    return messageId;
  }

  finalizeOptimisticMessage(tempMessageId: string, serverRecordId: string, sharedMessageId: string): void {
    this.messages.update((msgs) =>
      msgs.map((msg) =>
        msg.messageId === tempMessageId ? { ...msg, id: serverRecordId, messageId: sharedMessageId } : msg
      )
    );
  }

  private loadMessages(force = false): void {
    const contact = this.contact();
    if (!contact) return;
    const newContact = this.currentContactId !== contact.id;
    if (force || newContact) {
      this.currentContactId = contact.id;
      this.messageKeys.clear();
      this.messages.set([]);
      this.scrolledToFirstUnread = false;
      this.readTrackingEnabled = false;
      this.lastLiveMessageId = undefined;
      this.loaded.set(false);
    }
    this.loading.set(true);
    this.contactMessageService.list(contact.id, { limit: 200 })
      .subscribe({
        next: async (res) => {
          // Merge with already present (live/optimistic) messages so we do not drop them while loading
          const merged = new Map<string, ChatroomMessage>(
            this.messages().map((msg) => [msg.messageId, msg])
          );
          for (const msg of res.rows ?? []) {
            const payload = await this.contactMessageService.decryptAndVerify(contact, msg);
            const key = this.buildMessageKey(msg.id, msg.signature, msg.message);
            this.messageKeys.add(key);
            const existing = merged.get(msg.messageId);
            merged.set(msg.messageId, {
              id: msg.id,
              messageId: msg.messageId,
              direction: msg.direction,
              payload,
              createdAt: msg.createdAt,
              readAt: msg.readAt,
              status: msg.status,
              reaction: (msg as unknown as { reaction?: string | null }).reaction ?? null,
              showOriginal: existing?.showOriginal ?? false
            });
          }
          const mergedMessages = Array.from(merged.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
          this.messages.set(mergedMessages);
          this.loading.set(false);
          this.loaded.set(true);
          setTimeout(() => this.scrollToFirstUnread(), 0);
        },
        error: () => {
          this.loading.set(false);
          this.loaded.set(true);
        }
      });
  }

  private scrollToFirstUnread(): void {
    if (this.scrolledToFirstUnread) {
      return;
    }
    const rows = this.messageRows?.toArray() ?? [];
    if (!rows.length) {
      if (this.messages().length === 0) {
        this.scrolledToFirstUnread = true;
        this.readTrackingEnabled = true;
      }
      return;
    }
    // Messages are sorted newest first; find the oldest unread (last in the list)
    let target: ElementRef<HTMLElement> | undefined;
    for (let i = rows.length - 1; i >= 0; i -= 1) {
      const message = this.messages()[i];
      if (message && this.isUnread(message)) {
        target = rows[i];
        break;
      }
    }
    if (target?.nativeElement && this.messageScroll?.nativeElement) {
      // Place the unread message fully in view (top aligned)
      const container = this.messageScroll.nativeElement;
      const top = target.nativeElement.offsetTop - container.offsetTop;
      container.scrollTop = Math.max(0, top);
      this.scrolledToFirstUnread = true;
      this.readTrackingEnabled = true;
      this.observeUnread();
      return;
    }
    // No unread; mark as done so we don't retry
    this.scrolledToFirstUnread = true;
    this.readTrackingEnabled = true;
    this.observeUnread();
  }

  private observeUnread(): void {
    if (!this.readTrackingEnabled) {
      return;
    }
    const container = this.messageScroll?.nativeElement;
    if (!container) {
      return;
    }
    if (!this.visibilityObserver) {
      this.visibilityObserver = new IntersectionObserver((entries) => {
        const contact = this.contact();
        if (!contact) {
          return;
        }
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }
          const target = entry.target as HTMLElement;
          const messageId = target.dataset['messageId'];
          if (!messageId) {
            return;
          }
          const message = this.messages().find((m) => m.messageId === messageId);
          if (message && this.isUnread(message)) {
            this.markAsRead(messageId, contact);
            this.visibilityObserver?.unobserve(target);
          }
        });
      }, { root: container, threshold: 0.6 });
    }

    const rows = this.messageRows?.toArray() ?? [];
    rows.forEach((row, index) => {
      const message = this.messages()[index];
      if (message && this.isUnread(message)) {
        this.visibilityObserver!.observe(row.nativeElement);
      } else {
        this.visibilityObserver?.unobserve(row.nativeElement);
      }
    });
  }

  private buildMessageKey(id: string, signature: string, cipher: string): string {
    return `${id}|${signature}|${cipher}`;
  }

  setReaction(message: ChatroomMessage, reaction: string | null): void {
    const contact = this.contact();
    if (!contact || !this.userService.hasJwt()) {
      return;
    }
    this.messages.update((msgs) =>
      msgs.map((msg) =>
        msg.messageId === message.messageId ? { ...msg, reaction } : msg
      )
    );
    this.contactMessageService.reactToMessage({
      messageId: message.messageId,
      contactId: contact.id,
      reaction,
      userId: contact.userId,
      contactUserId: contact.contactUserId
    }).subscribe({
      next: () => {
        this.socketioService.sendReactionContactMessage({
          contactId: contact.id,
          userId: contact.userId,
          contactUserId: contact.contactUserId,
          messageId: message.messageId,
          reaction
        });
      },
      error: () => {
        // rollback best-effort
        this.messages.update((msgs) =>
          msgs.map((msg) =>
            msg.messageId === message.messageId ? { ...msg, reaction: message.reaction ?? null } : msg
          )
        );
      }
    });
  }

  openReactionPicker(message: ChatroomMessage, event: Event): void {
    event.stopPropagation();
    const dialogRef = this.matDialog.open(EmoticonPickerComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: { reactions: this.reactions, current: message.reaction },
      maxWidth: '95vw'
    });

    dialogRef.afterClosed().subscribe((result: string | null | undefined) => {
      if (result === undefined) {
        return;
      }
      this.setReaction(message, result);
    });
  }

  isNewDay(index: number): boolean {
    const list = this.messages();
    if (!list.length || index < 0 || index >= list.length) {
      return false;
    }
    if (index === 0) {
      return true;
    }
    const current = this.toDayKey(list[index].createdAt);
    const previous = this.toDayKey(list[index - 1].createdAt);
    return current !== previous;
  }

  formatDay(dateIso: string): string {
    const date = new Date(dateIso);
    const locale = typeof navigator !== 'undefined'
      ? (navigator.languages?.[0] ?? navigator.language ?? 'en-US')
      : 'en-US';
    try {
      return new Intl.DateTimeFormat(locale, {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }).format(date);
    } catch {
      return date.toLocaleDateString(locale);
    }
  }

  private toDayKey(dateIso: string): string {
    const d = new Date(dateIso);
    const y = d.getFullYear();
    const m = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private markAsRead(messageId: string, contact: Contact): void {
    this.contactMessageService.markReadBothCopies({
      messageId,
      contactId: contact.id,
      userId: contact.userId,
      contactUserId: contact.contactUserId
    }).subscribe({
      next: () => {
        this.messages.update((msgs) =>
          msgs.map((msg) =>
            msg.messageId === messageId ? { ...msg, status: 'read', readAt: msg.readAt ?? new Date().toISOString() } : msg
          )
        );
        this.contactMessageService.emitUnreadCountUpdate(contact.id);
        this.socketioService.sendReadContactMessage({
          contactId: contact.id,
          userId: contact.userId,
          contactUserId: contact.contactUserId,
          messageId
        });
      }
    });
  }

  private createEmptyMessage(): ShortMessage {
    return {
      message: '',
      style: '',
      multimedia: {
        type: MultimediaType.UNDEFINED,
        attribution: '',
        title: '',
        description: '',
        url: '',
        sourceUrl: '',
        contentId: ''
      },
      audio: null
    };
  }

  private base64ToBlob(base64: string, mimeType: string): Blob {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mimeType });
  }

  private async sendAsNewMessage(contact: Contact, payload: ShortMessage): Promise<void> {
    let encryptedMessageForUser = '';
    let encryptedMessageForContact = '';
    let signature = '';
    try {
      ({ encryptedMessageForUser, encryptedMessageForContact, signature } =
        await this.contactMessageService.encryptMessageForContact(contact, payload));
    } catch {
      this.snackBar.open(this.translation.t('common.contact.chatroom.sendFailed'), '', { duration: 3000 });
      return;
    }

    if (!this.isEncryptedMessageWithinLimit(encryptedMessageForUser, encryptedMessageForContact)) {
      this.snackBar.open(this.translation.t('common.contact.chatroom.messageTooLarge'), '', { duration: 3000 });
      return;
    }
    if (!this.isRequestWithinLimit(contact, encryptedMessageForUser, encryptedMessageForContact, signature)) {
      this.snackBar.open(this.translation.t('common.contact.chatroom.messageTooLarge'), '', { duration: 3000 });
      return;
    }

    const tempId = this.addOptimisticMessage(payload);

    this.contactMessageService.send({
      contactId: contact.id,
      userId: contact.userId,
      contactUserId: contact.contactUserId,
      direction: 'user',
      encryptedMessageForUser,
      encryptedMessageForContact,
      signature
    }).subscribe({
      next: (res) => {
        if (tempId) {
          this.finalizeOptimisticMessage(tempId, res.messageId, res.sharedMessageId);
        }
        this.socketioService.sendContactMessage({
          id: res.mirrorMessageId ?? res.messageId,
          messageId: res.sharedMessageId,
          contactId: contact.id,
          userId: contact.userId,
          contactUserId: contact.contactUserId,
          messageSignature: signature,
          userEncryptedMessage: encryptedMessageForUser,
          contactUserEncryptedMessage: encryptedMessageForContact
        });
      },
      error: (err) => {
        const isTooLarge = err?.status === 413 || `${err?.error?.error ?? ''}`.includes('too_large');
        if (tempId && isTooLarge) {
          this.removeOptimisticMessage(tempId);
        }
        const errorMessage = isTooLarge
          ? this.translation.t('common.contact.chatroom.messageTooLarge')
          : (err?.error?.error ?? this.translation.t('common.contact.chatroom.sendFailed'));
        this.snackBar.open(errorMessage, '', { duration: 3000 });
      }
    });
  }

  private isEncryptedMessageWithinLimit(forUser: string, forContact: string): boolean {
    return this.utf8Size(forUser) <= this.maxEncryptedMessageBytes
      && this.utf8Size(forContact) <= this.maxEncryptedMessageBytes;
  }

  private isRequestWithinLimit(contact: Contact, forUser: string, forContact: string, signature: string): boolean {
    const payload = {
      contactId: contact.id,
      userId: contact.userId,
      contactUserId: contact.contactUserId,
      direction: 'user',
      encryptedMessageForUser: forUser,
      encryptedMessageForContact: forContact,
      signature
    };
    return this.utf8Size(JSON.stringify(payload)) <= this.maxRequestBytes;
  }

  private utf8Size(value: string): number {
    return new TextEncoder().encode(value).length;
  }

  private removeOptimisticMessage(messageId: string): void {
    this.messages.update((msgs) => msgs.filter((msg) => msg.messageId !== messageId));
  }

  mapStatus(status?: string): string {
    return this.contactMessageService.mapStatusIcon(status as ('sent' | 'delivered' | 'read' | 'deleted' | undefined));
  }

  private scrollToTop(): void {
    const container = this.messageScroll?.nativeElement;
    if (!container) {
      return;
    }
    container.scrollTop = 0;
  }

  private scrollToTopIfNeeded(): void {
    const container = this.messageScroll?.nativeElement;
    if (!container) {
      return;
    }
    if (container.scrollTop > 0) {
      container.scrollTop = 0;
    }
  }

  private setShowOriginal(messageId: string, showOriginal: boolean): void {
    this.messages.update((msgs) =>
      msgs.map((msg) =>
        msg.messageId === messageId ? { ...msg, showOriginal } : msg
      )
    );
  }

  private async persistTranslation(messageId: string, translation: string): Promise<void> {
    const contact = this.contact();
    if (!contact) {
      return;
    }
    try {
      const encryptedTranslation = await this.contactMessageService.encryptTranslation(translation);
      this.contactMessageService.updateTranslation({
        messageId,
        contactId: contact.id,
        translatedMessage: encryptedTranslation,
        userId: this.userService.getUser().id
      }).subscribe({
        error: (err) => {
          const errorMessage = err?.error?.error ?? this.translation.t('common.contact.chatroom.storeTranslationFailed');
          this.snackBar.open(errorMessage, '', { duration: 3000 });
        }
      });
    } catch {
      this.snackBar.open(this.translation.t('common.contact.chatroom.storeTranslationFailed'), '', { duration: 3000 });
    }
  }
}
