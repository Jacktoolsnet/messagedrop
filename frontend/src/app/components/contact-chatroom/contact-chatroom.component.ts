
import { AfterViewInit, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, QueryList, ViewChild, ViewChildren, computed, effect, inject, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTabsModule } from '@angular/material/tabs';
import { TranslocoPipe } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { Contact } from '../../interfaces/contact';
import {
  ChatGame,
  AsteroidDuelAction,
  AsteroidDuelGame,
  TreasureIslandItem,
  TreasureMapAction,
  TreasureMapGame,
  WordRescueAction,
  WordRescueGame,
  CheckersGame,
  CodeGame,
  CodeSymbol,
  ConnectFourGame,
  ConnectFourVariant,
  DotsAndBoxesGame,
  DotsAndBoxesMove,
  GameStats,
  MemoryGame,
  MinefieldGame,
  MinefieldHideSeekGame,
  MorrisGame,
  RockPaperScissorsChoice,
  RockPaperScissorsGame,
  TicTacToeGame,
  TicTacToeMark,
  TicTacToeStats,
  TicTacToeVariant
} from '../../interfaces/chat-game';
import { ContactMessage } from '../../interfaces/contact-message';
import { Location } from '../../interfaces/location';
import { Mode } from '../../interfaces/mode';
import { MultimediaType } from '../../interfaces/multimedia-type';
import { ShortMessage } from '../../interfaces/short-message';
import { ExperienceResult } from '../../interfaces/viator';
import { ContactMessageNotificationType, ContactMessageService } from '../../services/contact-message.service';
import { CryptoService } from '../../services/crypto.service';
import { CryptoData } from '../../interfaces/crypto-data';
import { ContactService } from '../../services/contact.service';
import { AppService } from '../../services/app.service';
import { ExperienceBookmarkService } from '../../services/experience-bookmark.service';
import { ExternalContentConsentService } from '../../services/external-content-consent.service';
import { GameFeedbackService } from '../../services/game-feedback.service';
import { SpeechService } from '../../services/speech.service';
import { LanguageService } from '../../services/language.service';
import { MapService } from '../../services/map.service';
import { SocketioService } from '../../services/socketio.service';
import { SharedContentService } from '../../services/shared-content.service';
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
import { LocationPreviewComponent } from '../utils/location-preview/location-preview.component';
import { ExperienceSearchComponent } from '../utils/experience-search/experience-search.component';
import { ExperienceSearchDetailDialogComponent } from '../utils/experience-search/detail-dialog/experience-search-detail-dialog.component';
import { DisplayMessage } from '../utils/display-message/display-message.component';
import { ContactChatroomExperienceSelectDialogComponent } from './experience-select-dialog/contact-chatroom-experience-select-dialog.component';
import { ChatGameType, GameSelectDialogComponent } from './game-select-dialog/game-select-dialog.component';
import { GameRulesDialogComponent } from './game-rules-dialog/game-rules-dialog.component';
import { NewTicTacToeDialogComponent } from './new-tic-tac-toe-dialog/new-tic-tac-toe-dialog.component';
import { TicTacToeBoardComponent } from './tic-tac-toe-board/tic-tac-toe-board.component';
import { NewConnectFourDialogComponent } from './new-connect-four-dialog/new-connect-four-dialog.component';
import { ConnectFourBoardComponent } from './connect-four-board/connect-four-board.component';
import { DotsAndBoxesBoardComponent } from './dots-and-boxes-board/dots-and-boxes-board.component';
import { NewDotsAndBoxesDialogComponent } from './new-dots-and-boxes-dialog/new-dots-and-boxes-dialog.component';
import { NewRockPaperScissorsDialogComponent } from './new-rock-paper-scissors-dialog/new-rock-paper-scissors-dialog.component';
import { RockPaperScissorsBoardComponent } from './rock-paper-scissors-board/rock-paper-scissors-board.component';
import { CodeBoardComponent } from './code-board/code-board.component';
import { NewCodeDialogComponent } from './new-code-dialog/new-code-dialog.component';
import { MemoryBoardComponent } from './memory-board/memory-board.component';
import { NewMemoryDialogComponent, NewMemoryDialogResult } from './new-memory-dialog/new-memory-dialog.component';
import { MinefieldBoardComponent } from './minefield-board/minefield-board.component';
import { NewMinefieldDialogComponent } from './new-minefield-dialog/new-minefield-dialog.component';
import { MinefieldHideSeekBoardComponent } from './minefield-hide-seek-board/minefield-hide-seek-board.component';
import { NewMinefieldHideSeekDialogComponent } from './new-minefield-hide-seek-dialog/new-minefield-hide-seek-dialog.component';
import { MorrisBoardComponent } from './morris-board/morris-board.component';
import { NewMorrisDialogComponent } from './new-morris-dialog/new-morris-dialog.component';
import { CheckersBoardComponent } from './checkers-board/checkers-board.component';
import { NewCheckersDialogComponent } from './new-checkers-dialog/new-checkers-dialog.component';
import { AsteroidDuelBoardComponent } from './asteroid-duel-board/asteroid-duel-board.component';
import { NewAsteroidDuelDialogComponent, NewAsteroidDuelDialogResult } from './new-asteroid-duel-dialog/new-asteroid-duel-dialog.component';
import { TreasureMapBoardComponent } from './treasure-map-board/treasure-map-board.component';
import { NewTreasureMapDialogComponent } from './new-treasure-map-dialog/new-treasure-map-dialog.component';
import { WordRescueBoardComponent } from './word-rescue-board/word-rescue-board.component';
import { NewWordRescueDialogComponent, NewWordRescueDialogResult } from './new-word-rescue-dialog/new-word-rescue-dialog.component';
import { DeleteContactMessageComponent } from './delete-contact-message/delete-contact-message.component';
import { DisplayMessageService } from '../../services/display-message.service';
import { ProtectedStickerImageComponent } from '../utils/protected-sticker-image/protected-sticker-image.component';
import { hasSufficientMessageVisibility, MESSAGE_READ_VISIBILITY_THRESHOLDS } from './message-read-visibility';
import {
  ContactMessageRevisionHistoryComponent,
  ContactMessageRevisionHistoryEntry
} from './revision-history/contact-message-revision-history.component';
import { applyTicTacToeMove, createTicTacToeGame } from '../../utils/tic-tac-toe';
import { applyConnectFourMove, createConnectFourGame } from '../../utils/connect-four';
import { applyDotsAndBoxesMove, createDotsAndBoxesGame } from '../../utils/dots-and-boxes';
import { applyRockPaperScissorsChoice, createRockPaperScissorsGame } from '../../utils/rock-paper-scissors';
import { createCodeCommitment, createCodeGame, CodeSecret, evaluateCodeGuess, isValidCode, submitAndEvaluateCodeGuess } from '../../utils/code-game';
import { applyMemoryTurn, createMemoryGame } from '../../utils/memory-game';
import { applyMinefieldMove, createMinefieldGame } from '../../utils/minefield-game';
import { applyHideSeekSearch, applySecondMinePlacement, createMinefieldHideSeekGame, currentHideSeekRound } from '../../utils/minefield-hide-seek';
import { applyMorrisAction, createMorrisGame, MorrisAction } from '../../utils/morris-game';
import { applyCheckersMove, CheckersAction, createCheckersGame } from '../../utils/checkers-game';
import { applyAsteroidDuelAction, createAsteroidDuelGame } from '../../utils/asteroid-duel-game';
import { applyTreasureMapAction, createTreasureMapGame, placeTreasureMapOpponent } from '../../utils/treasure-map-game';
import { applyWordRescueAction, createWordRescueGame } from '../../utils/word-rescue-game';

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

interface AudioWaveBar {
  value: number;
  active: boolean;
}

interface PersistedPayloadEntry {
  messageId: string;
  payload: ShortMessage;
}

interface ContactChatroomDialogData {
  contactId: string;
  focusMessageId?: string;
}

@Component({
  selector: 'app-contact-chatroom',
  imports: [
    ProtectedStickerImageComponent,
    MatCardModule,
    MatButtonModule,
    MatMenuModule,
    MatTabsModule,
    MatDialogActions,
    MatDialogTitle,
    MatIcon,
    ShowmultimediaComponent,
    ShowmessageComponent,
    LocationPreviewComponent,
    TicTacToeBoardComponent,
    ConnectFourBoardComponent,
    DotsAndBoxesBoardComponent,
    RockPaperScissorsBoardComponent,
    CodeBoardComponent,
    MemoryBoardComponent,
    MinefieldBoardComponent,
    MinefieldHideSeekBoardComponent,
    MorrisBoardComponent,
    CheckersBoardComponent,
    AsteroidDuelBoardComponent,
    TreasureMapBoardComponent,
    WordRescueBoardComponent,
    TranslocoPipe
  ],
  templateUrl: './contact-chatroom.component.html',
  styleUrl: './contact-chatroom.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ContactChatroomComponent implements AfterViewInit {
  readonly Math = Math;
  private readonly appService = inject(AppService);
  private readonly userService = inject(UserService);
  private readonly socketioService = inject(SocketioService);
  private readonly contactService = inject(ContactService);
  private readonly experienceBookmarkService = inject(ExperienceBookmarkService);
  private readonly externalContentConsent = inject(ExternalContentConsentService);
  private readonly mapService = inject(MapService);
  readonly help = inject(HelpDialogService);
  readonly gameFeedback = inject(GameFeedbackService);
  private readonly contactMessageService = inject(ContactMessageService);
  private readonly cryptoService = inject(CryptoService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly matDialog = inject(MatDialog);
  private readonly dialogRef = inject(MatDialogRef<ContactChatroomComponent>);
  private readonly dialogData = inject<string | ContactChatroomDialogData>(MAT_DIALOG_DATA);
  private readonly translateService = inject(TranslateService);
  private readonly snackBar = inject(DisplayMessageService);
  private readonly speechService = inject(SpeechService);
  private readonly translation = inject(TranslationHelperService);
  private readonly languageService = inject(LanguageService);
  private readonly sharedContentService = inject(SharedContentService);
  private readonly contactId = typeof this.dialogData === 'string' ? this.dialogData : this.dialogData.contactId;
  private readonly focusMessageId = typeof this.dialogData === 'string' ? undefined : this.dialogData.focusMessageId;

  @ViewChild('messageScroll') private messageScroll?: ElementRef<HTMLElement>;
  @ViewChildren('messageRow') private messageRows?: QueryList<ElementRef<HTMLElement>>;

  readonly contact = computed(() =>
    this.contactService.sortedContactsSignal().find(contact => contact.id === this.contactId)
  );
  readonly contactRemoved = computed(() => this.contact()?.status === 'removed_by_contact');
  readonly profile = computed(() => {
    this.userService.profileVersion();
    return this.userService.getProfile();
  });
  readonly composeMessage = output<Contact>();
  readonly messages = signal<ChatroomMessage[]>([]);
  readonly visibleMessages = computed(() => {
    const allMessages = this.messages();
    const replacedMessageIds = new Set(
      allMessages
        .map((message) => message.payload?.revisionOfMessageId?.trim())
        .filter((messageId): messageId is string => !!messageId)
    );
    return allMessages.filter((message) => !replacedMessageIds.has(message.messageId));
  });
  readonly loading = signal<boolean>(false);
  readonly loaded = signal<boolean>(false);
  readonly hasSavedExperiences = computed(() => this.experienceBookmarkService.bookmarksSignal().length > 0);
  readonly translationTargetLabel = computed(() =>
    this.translation.t(`common.languageNames.${this.languageService.effectiveLanguage()}`)
  );
  private readonly messageKeys = new Set<string>();
  private readonly liveMineAnimationMessageIds = new Set<string>();
  private readonly liveAsteroidHitMoves = new Set<string>();
  private readonly payloadSyncInFlightContacts = new Set<string>();
  private readonly tabbedMessageIds = new Set<string>();
  private initialTabbedMessagesCaptured = false;
  private readonly experienceEditTarget = signal<ChatroomMessage | null>(null);
  private readonly gameMovesInFlight = signal<ReadonlySet<string>>(new Set());
  private readonly visibleMinefieldLayouts = signal<ReadonlySet<string>>(new Set());
  private scrolledToFirstUnread = false;
  private readTrackingEnabled = false;
  private visibilityObserver?: IntersectionObserver;
  private readonly readRequestsInFlight = new Set<string>();
  private currentContactId?: string;
  private lastLiveMessageId?: string;
  private lastResetToken?: number;
  private initialFocusHandled = false;
  private readonly audioUrlCache = new Map<string, string>();
  private readonly audioDurationCache = new Map<string, number>();
  private readonly audioDurationPending = new Set<string>();
  private audioPlayer?: HTMLAudioElement;
  private playingMessageId?: string;
  private playbackTimer?: ReturnType<typeof setInterval>;
  private playbackStartedAt = 0;
  private playbackStartedOffset = 0;
  private playbackFallbackDuration = 0;
  private readonly audioProgress = signal<Record<string, number>>({});
  private readonly maxEncryptedMessageBytes = 1_500_000;
  private readonly maxRequestBytes = 2_000_000;
  private readonly maxPerMessageBytes = Math.min(this.maxEncryptedMessageBytes, Math.floor(this.maxRequestBytes * 0.45));
  private readonly maxAudioBase64Bytes = Math.floor(this.maxPerMessageBytes / 4.3);
  private readonly maxAudioMessages = 5;
  private readonly audioWaveWindow = 60;
  private readonly clearedWaveValue = 0.08;
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
  readonly audioLimitReached = computed(() => {
    let count = 0;
    for (const msg of this.visibleMessages()) {
      if (msg.direction === 'user' && msg.payload?.audio) {
        count += 1;
        if (count >= this.maxAudioMessages) {
          return true;
        }
      }
    }
    return false;
  });

  constructor() {
    void this.experienceBookmarkService.ensureLoaded().catch(() => undefined);
    this.destroyRef.onDestroy(() => {
      this.visibilityObserver?.disconnect();
      this.visibilityObserver = undefined;
      this.readRequestsInFlight.clear();
      this.audioUrlCache.forEach((url) => URL.revokeObjectURL(url));
      this.audioUrlCache.clear();
      this.audioDurationCache.clear();
      this.audioDurationPending.clear();
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
      if(incoming.direction==='contactUser'&&payload?.game?.type==='minefieldHideSeek'
        &&currentHideSeekRound(payload.game)?.lastMove?.hitMine){
        this.liveMineAnimationMessageIds.add(incoming.id);
        setTimeout(()=>this.liveMineAnimationMessageIds.delete(incoming.id),10_000);
      }
      if(incoming.direction==='contactUser'&&payload?.game?.type==='asteroidDuel'&&payload.game.lastMove?.hitPlayer){
        this.rememberAsteroidHit(payload.game);
      }
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
      if (payload) {
        void this.persistPayloadBatch(contact.id, [{ messageId: incoming.messageId, payload }]);
      }
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

  private readonly updatedMessagesEffect = effect(async () => {
    const updated = this.contactMessageService.updatedMessages();
    if (!updated) {
      return;
    }
    const contact = this.contact();
    const updatedPayload = contact && updated.contactId === contact.id && updated.message?.trim()
      ? await this.contactMessageService.decryptAndVerify(contact, updated)
      : null;
    this.messages.update((msgs) =>
      msgs.map((msg) =>
        msg.messageId === updated.messageId
          ? {
            ...msg,
            payload: updatedPayload ?? msg.payload,
            status: updated.status ?? msg.status,
            readAt: updated.status === 'read' ? (msg.readAt ?? new Date().toISOString()) : msg.readAt
          }
          : msg
      )
    );
    if (updatedPayload && contact) {
      void this.persistPayloadBatch(contact.id, [{ messageId: updated.messageId, payload: updatedPayload }]);
    }
    if (this.contactMessageService.updatedMessages() === updated) {
      this.contactMessageService.updatedMessages.set(null);
    }
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
    if (removed) {
      void this.contactMessageService.deleteLocalPayload(deleted.messageId);
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
          setTimeout(() => this.scrollToInitialTarget(), 0);
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

  async requestCompose(): Promise<void> {
    const currentContact = this.contact();
    if (!currentContact) {
      return;
    }
    const shortMessage = this.createEmptyMessage();
    await this.sharedContentService.addSharedContentToShortMessage(shortMessage);

    const dialogRef = this.matDialog.open(ContactEditMessageComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: { mode: Mode.ADD_SHORT_MESSAGE, contact: currentContact, shortMessage },
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

  openGameSelection(): void {
    const contact = this.contact();
    if (!contact || contact.status === 'removed_by_contact') {
      return;
    }
    const dialogRef = this.matDialog.open(GameSelectDialogComponent, {
      data: {
        ticTacToeStats: this.getTicTacToeStats('standard'),
        vanishingTicTacToeStats: this.getTicTacToeStats('vanishing'),
        connectFourStats: this.getConnectFourStats('standard'),
        vanishingConnectFourStats: this.getConnectFourStats('vanishing'),
        dotsAndBoxesStats: this.getDotsAndBoxesStats(),
        rockPaperScissorsStats: this.getRockPaperScissorsStats(),
        codeStats: this.getCodeStats(),
        memoryStats: this.getMemoryStats(),
        minefieldStats: this.getMinefieldStats(),
        minefieldHideSeekStats: this.getMinefieldHideSeekStats()
        ,morrisStats:this.getMorrisStats(),checkersStats:this.getCheckersStats(),asteroidDuelStats:this.getAsteroidDuelStats(),treasureMapStats:this.getTreasureMapStats(),wordRescueStats:this.getWordRescueStats()
      },
      width: 'min(760px, 94vw)',
      maxWidth: '94vw',
      maxHeight: '85vh',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: false
    });

    dialogRef.afterClosed().subscribe((gameType?: ChatGameType) => {
      if (gameType === 'ticTacToe') {
        this.openNewTicTacToeDialog(contact, 'standard');
      } else if (gameType === 'ticTacToeVanishing') {
        this.openNewTicTacToeDialog(contact, 'vanishing');
      } else if (gameType === 'connectFour') {
        this.openNewConnectFourDialog(contact, 'standard');
      } else if (gameType === 'connectFourVanishing') {
        this.openNewConnectFourDialog(contact, 'vanishing');
      } else if (gameType === 'dotsAndBoxes') {
        this.openNewDotsAndBoxesDialog(contact);
      } else if (gameType === 'rockPaperScissors') {
        this.openNewRockPaperScissorsDialog(contact);
      } else if (gameType === 'code') {
        this.openNewCodeDialog(contact);
      } else if (gameType === 'memory') {
        this.openNewMemoryDialog(contact);
      } else if (gameType === 'minefield') {
        this.openNewMinefieldDialog(contact);
      } else if (gameType === 'minefieldHideSeek') {
        this.openNewMinefieldHideSeekDialog(contact);
      } else if(gameType==='morris'){
        this.openNewMorrisDialog(contact);
      }else if(gameType==='checkers'){
        this.openNewCheckersDialog(contact);
      }else if(gameType==='asteroidDuel'){
        this.openNewAsteroidDuelDialog(contact);
      }else if(gameType==='treasureMap'){
        this.openNewTreasureMapDialog(contact);
      }else if(gameType==='wordRescue'){
        this.openNewWordRescueDialog(contact);
      }
    });
  }

  private openNewConnectFourDialog(contact: Contact, variant: ConnectFourVariant, revisionOfMessageId?:string): void {
    const dialogRef = this.matDialog.open(NewConnectFourDialogComponent, {
      data: { variant },
      width: 'min(470px, 96vw)',
      maxWidth: '96vw',
      maxHeight: '90vh',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: false
    });
    dialogRef.afterClosed().subscribe((firstColumn?: number) => {
      if (!Number.isInteger(firstColumn)) return;
      const payload = this.createEmptyMessage();
      payload.game = createConnectFourGame(contact.userId, contact.contactUserId, firstColumn!, variant);
      void this.sendAsNewMessage(contact, payload, revisionOfMessageId, 'game_started');
    });
  }

  private openNewDotsAndBoxesDialog(contact: Contact, revisionOfMessageId?:string): void {
    const dialogRef = this.matDialog.open(NewDotsAndBoxesDialogComponent, {
      width: 'min(470px, 96vw)',
      maxWidth: '96vw',
      maxHeight: '90vh',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: false
    });
    dialogRef.afterClosed().subscribe((firstMove?: DotsAndBoxesMove) => {
      if (!firstMove) return;
      const payload = this.createEmptyMessage();
      payload.game = createDotsAndBoxesGame(contact.userId, contact.contactUserId, firstMove);
      void this.sendAsNewMessage(contact, payload, revisionOfMessageId, 'game_started');
    });
  }

  private openNewRockPaperScissorsDialog(contact: Contact, revisionOfMessageId?:string): void {
    const dialogRef = this.matDialog.open(NewRockPaperScissorsDialogComponent, {
      width: 'min(440px, 94vw)',
      maxWidth: '94vw',
      maxHeight: '90vh',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: false
    });
    dialogRef.afterClosed().subscribe((choice?: RockPaperScissorsChoice) => {
      if (!choice) return;
      const payload = this.createEmptyMessage();
      payload.game = createRockPaperScissorsGame(contact.userId, contact.contactUserId, choice);
      void this.sendAsNewMessage(contact, payload, revisionOfMessageId, 'game_started');
    });
  }

  private openNewCodeDialog(contact: Contact, revisionOfMessageId?:string): void {
    const dialogRef = this.matDialog.open(NewCodeDialogComponent, {
      width: 'min(470px, 96vw)', maxWidth: '96vw', maxHeight: '90vh', hasBackdrop: true,
      backdropClass: 'dialog-backdrop', disableClose: false, autoFocus: false
    });
    dialogRef.afterClosed().subscribe((code?: CodeSymbol[]) => {
      if (!isValidCode(code)) return;
      void this.startCodeGame(contact, code, revisionOfMessageId);
    });
  }

  private openNewMemoryDialog(contact: Contact, revisionOfMessageId?:string): void {
    const dialogRef = this.matDialog.open(NewMemoryDialogComponent, {
      width: 'min(470px, 96vw)', maxWidth: '96vw', maxHeight: '90vh', hasBackdrop: true,
      backdropClass: 'dialog-backdrop', disableClose: false, autoFocus: false
    });
    dialogRef.afterClosed().subscribe((result?: NewMemoryDialogResult) => {
      if (!result) return;
      try {
        const payload = this.createEmptyMessage();
        payload.game = createMemoryGame(contact.userId, contact.contactUserId, result.cards, result.firstTurn);
        void this.sendAsNewMessage(contact, payload, revisionOfMessageId, 'game_started');
      } catch {
        this.snackBar.open(this.translation.t('common.contact.chatroom.games.memoryStartFailed'), '', { duration: 3000 });
      }
    });
  }

  private openNewMinefieldDialog(contact: Contact, revisionOfMessageId?:string): void {
    const dialogRef = this.matDialog.open(NewMinefieldDialogComponent, {
      width: 'min(500px, 96vw)', maxWidth: '96vw', maxHeight: '90vh', hasBackdrop: true,
      backdropClass: 'dialog-backdrop', disableClose: false, autoFocus: false
    });
    dialogRef.afterClosed().subscribe((firstCell?: number) => {
      if (!Number.isInteger(firstCell)) return;
      try {
        const payload = this.createEmptyMessage();
        payload.game = createMinefieldGame(contact.userId, contact.contactUserId, firstCell!);
        void this.sendAsNewMessage(contact, payload, revisionOfMessageId, 'game_started');
      } catch {
        this.snackBar.open(this.translation.t('common.contact.chatroom.games.minefieldStartFailed'), '', { duration: 3000 });
      }
    });
  }

  private openNewMinefieldHideSeekDialog(contact: Contact, revisionOfMessageId?:string): void {
    const ref = this.matDialog.open(NewMinefieldHideSeekDialogComponent, {
      width: 'min(500px, 96vw)', maxWidth: '96vw', maxHeight: '90vh', hasBackdrop: true,
      backdropClass: 'dialog-backdrop', disableClose: false, autoFocus: false
    });
    ref.afterClosed().subscribe((mines?: number[]) => {
      if (!mines) return;
      try {
        const payload = this.createEmptyMessage();
        payload.game = createMinefieldHideSeekGame(contact.userId, contact.contactUserId, mines);
        void this.sendAsNewMessage(contact, payload, revisionOfMessageId, 'game_started');
      } catch {
        this.snackBar.open(this.translation.t('common.contact.chatroom.games.minefieldStartFailed'), '', { duration: 3000 });
      }
    });
  }

  private openNewMorrisDialog(contact:Contact,revisionOfMessageId?:string):void{
    const ref=this.matDialog.open(NewMorrisDialogComponent,{width:'min(500px,96vw)',maxWidth:'96vw',maxHeight:'90vh',hasBackdrop:true,backdropClass:'dialog-backdrop',autoFocus:false});
    ref.afterClosed().subscribe((position?:number)=>{if(!Number.isInteger(position))return;const payload=this.createEmptyMessage();payload.game=createMorrisGame(contact.userId,contact.contactUserId,position!);void this.sendAsNewMessage(contact,payload,revisionOfMessageId,'game_started')});
  }
  private openNewCheckersDialog(contact:Contact,revisionOfMessageId?:string):void{const ref=this.matDialog.open(NewCheckersDialogComponent,{width:'min(500px,96vw)',maxWidth:'96vw',maxHeight:'90vh',hasBackdrop:true,backdropClass:'dialog-backdrop',autoFocus:false});ref.afterClosed().subscribe((move?:CheckersAction)=>{if(!move)return;const payload=this.createEmptyMessage();payload.game=createCheckersGame(contact.userId,contact.contactUserId,move);void this.sendAsNewMessage(contact,payload,revisionOfMessageId,'game_started')})}
  private openNewAsteroidDuelDialog(contact:Contact,revisionOfMessageId?:string):void{const ref=this.matDialog.open(NewAsteroidDuelDialogComponent,{width:'min(520px,96vw)',maxWidth:'96vw',maxHeight:'90vh',hasBackdrop:true,backdropClass:'dialog-backdrop',autoFocus:false});ref.afterClosed().subscribe((result?:NewAsteroidDuelDialogResult)=>{if(!result)return;try{const payload=this.createEmptyMessage();payload.game=createAsteroidDuelGame(contact.userId,contact.contactUserId,result.asteroids,result.action);void this.sendAsNewMessage(contact,payload,revisionOfMessageId,'game_started')}catch{this.snackBar.open(this.translation.t('common.contact.chatroom.games.asteroidStartFailed'),'',{duration:3000})}})}
  private openNewTreasureMapDialog(contact:Contact,revisionOfMessageId?:string):void{const ref=this.matDialog.open(NewTreasureMapDialogComponent,{width:'min(520px,96vw)',maxWidth:'96vw',maxHeight:'90vh',hasBackdrop:true,backdropClass:'dialog-backdrop',autoFocus:false});ref.afterClosed().subscribe((layout?:(TreasureIslandItem|null)[])=>{if(!layout)return;try{const payload=this.createEmptyMessage();payload.game=createTreasureMapGame(contact.userId,contact.contactUserId,layout);void this.sendAsNewMessage(contact,payload,revisionOfMessageId,'game_started')}catch{this.snackBar.open(this.translation.t('common.contact.chatroom.games.treasureMapStartFailed'),'',{duration:3000})}})}
  private openNewWordRescueDialog(contact:Contact,revisionOfMessageId?:string):void{const ref=this.matDialog.open(NewWordRescueDialogComponent,{width:'min(500px,96vw)',maxWidth:'96vw',maxHeight:'90vh',hasBackdrop:true,backdropClass:'dialog-backdrop',autoFocus:false});ref.afterClosed().subscribe((result?:NewWordRescueDialogResult)=>{if(!result)return;try{const payload=this.createEmptyMessage();payload.game=createWordRescueGame(contact.userId,contact.contactUserId,result.solution,result.hint);void this.sendAsNewMessage(contact,payload,revisionOfMessageId,'game_started')}catch{this.snackBar.open(this.translation.t('common.contact.chatroom.games.wordRescueStartFailed'),'',{duration:3000})}})}

  private async startCodeGame(contact: Contact, code: CodeSymbol[], revisionOfMessageId?:string): Promise<void> {
    try {
      const secret: CodeSecret = { code: [...code], nonce: crypto.randomUUID() };
      const [encryptedSecret, encryptedSecretForCodeBreaker, commitment] = await Promise.all([
        this.cryptoService.encrypt(this.userService.getUser().cryptoKeyPair.publicKey, JSON.stringify(secret)),
        this.cryptoService.encrypt(contact.contactUserEncryptionPublicKey!, JSON.stringify(secret)),
        createCodeCommitment(secret)
      ]);
      const payload = this.createEmptyMessage();
      payload.game = createCodeGame(contact.userId, contact.contactUserId, encryptedSecret, commitment, encryptedSecretForCodeBreaker);
      await this.sendAsNewMessage(contact, payload, revisionOfMessageId, 'game_started');
    } catch {
      this.snackBar.open(this.translation.t('common.contact.chatroom.games.codeStartFailed'), '', { duration: 3000 });
    }
  }

  private openNewTicTacToeDialog(contact: Contact, variant: TicTacToeVariant, revisionOfMessageId?:string): void {
    const dialogRef = this.matDialog.open(NewTicTacToeDialogComponent, {
      data: { variant },
      width: 'min(390px, 94vw)',
      maxWidth: '94vw',
      maxHeight: '90vh',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: false
    });

    dialogRef.afterClosed().subscribe((firstCell?: number) => {
      if (!Number.isInteger(firstCell)) {
        return;
      }
      const game = createTicTacToeGame(contact.userId, contact.contactUserId, firstCell!, variant);
      const payload = this.createEmptyMessage();
      payload.game = game;
      void this.sendAsNewMessage(contact, payload, revisionOfMessageId, 'game_started');
    });
  }

  canPlayTicTacToe(message: ChatroomMessage): boolean {
    const game = message.payload?.game;
    if (!game || game.type !== 'ticTacToe' || this.gameMovesInFlight().has(game.gameId)) {
      return false;
    }
    return game.status === 'active' && game.nextPlayerUserId === this.userService.getUser().id;
  }

  getTicTacToePlayerMark(game: TicTacToeGame): TicTacToeMark | null {
    const currentUserId = this.userService.getUser().id;
    return currentUserId === game.playerXUserId
      ? 'X'
      : currentUserId === game.playerOUserId
        ? 'O'
        : null;
  }

  getChatGameIcon(game: ChatGame): string {
    if(game.type==='wordRescue')return'spellcheck';
    if(game.type==='treasureMap')return'map';
    if(game.type==='asteroidDuel')return'rocket_launch';
    if(game.type==='checkers')return'grid_view';
    if(game.type==='morris')return'hub';
    if (game.type === 'minefieldHideSeek') return 'radar';
    if (game.type === 'minefield') return 'grid_on';
    if (game.type === 'memory') return 'style';
    if (game.type === 'code') return 'password';
    if (game.type === 'dotsAndBoxes') return 'border_outer';
    if (game.type === 'rockPaperScissors') return 'content_cut';
    return game.variant === 'vanishing' ? 'change_circle' : game.type === 'connectFour' ? 'view_column' : 'grid_3x3';
  }

  getChatGameTitle(game: ChatGame): string {
    const key = game.type === 'treasureMap'
      ? 'common.contact.chatroom.games.treasureMap'
      : game.type === 'wordRescue'
      ? 'common.contact.chatroom.games.wordRescue'
      : game.type === 'asteroidDuel'
      ? 'common.contact.chatroom.games.asteroidDuel'
      : game.type === 'checkers'
      ? 'common.contact.chatroom.games.checkers'
      : game.type === 'morris'
      ? 'common.contact.chatroom.games.morris'
      : game.type === 'minefieldHideSeek'
      ? 'common.contact.chatroom.games.minefield'
      : game.type === 'minefield'
      ? 'common.contact.chatroom.games.minefield'
      : game.type === 'memory'
      ? 'common.contact.chatroom.games.memory'
      : game.type === 'code'
      ? 'common.contact.chatroom.games.code'
      : game.type === 'connectFour'
      ? 'common.contact.chatroom.games.connectFour'
      : game.type === 'dotsAndBoxes'
        ? 'common.contact.chatroom.games.dotsAndBoxes'
        : game.type === 'rockPaperScissors'
          ? 'common.contact.chatroom.games.rockPaperScissors'
          : 'common.contact.chatroom.games.ticTacToe';
    return this.translation.t(key);
  }

  getChatGameVariantLabel(game: ChatGame): string {
    if(game.type==='wordRescue')return this.translation.t('common.contact.chatroom.games.standardVariant');
    if(game.type==='treasureMap')return this.translation.t('common.contact.chatroom.games.standardVariant');
    if(game.type==='asteroidDuel')return this.translation.t('common.contact.chatroom.games.standardVariant');
    if(game.type==='checkers')return this.translation.t('common.contact.chatroom.games.standardVariant');
    if(game.type==='morris')return this.translation.t('common.contact.chatroom.games.standardVariant');
    if (game.type === 'minefieldHideSeek') return this.translation.t('common.contact.chatroom.games.hideSeekVariant');
    if (game.type === 'minefield') return this.translation.t('common.contact.chatroom.games.duelVariant');
    const key = game.type !== 'dotsAndBoxes' && game.type !== 'rockPaperScissors' && game.type !== 'code' && game.type !== 'memory' && game.variant === 'vanishing'
      ? 'common.contact.chatroom.games.vanishingVariant'
      : 'common.contact.chatroom.games.standardVariant';
    return this.translation.t(key);
  }

  isCurrentUserGameTurn(game: ChatGame): boolean {
    return game.nextPlayerUserId === this.userService.getUser().id;
  }

  getCurrentUserId(): string {
    return this.userService.getUser().id;
  }

  shouldAnimateIncomingMine(message:ChatroomMessage,game:MinefieldHideSeekGame):boolean{
    return message.direction==='contactUser'&&this.liveMineAnimationMessageIds.has(message.id)
      &&!!currentHideSeekRound(game)?.lastMove?.hitMine;
  }

  shouldAnimateAsteroidHit(game:AsteroidDuelGame):boolean{return this.liveAsteroidHitMoves.has(`${game.gameId}:${game.moveNumber}`)}
  private rememberAsteroidHit(game:AsteroidDuelGame):void{const key=`${game.gameId}:${game.moveNumber}`;this.liveAsteroidHitMoves.add(key);setTimeout(()=>this.liveAsteroidHitMoves.delete(key),10_000)}

  isCurrentUserGameWinner(game: ChatGame): boolean {
    return game.winnerUserId === this.userService.getUser().id;
  }

  getGameStateEmoji(game: ChatGame): string {
    if (game.status === 'active') return this.isCurrentUserGameTurn(game) ? '🫵' : '⏳';
    if (game.status === 'won') return this.isCurrentUserGameWinner(game) ? '🥳' : '😢';
    return '🤝';
  }

  getGameStateLabel(game: ChatGame): string {
    if (game.status === 'active') {
      if (this.isCurrentUserGameTurn(game)) return this.translation.t('common.contact.chatroom.games.statusYourTurn');
      const name = this.contact()?.name || this.translation.t('common.contact.chatroom.contactLabel');
      return this.translation.t('common.contact.chatroom.games.statusContactTurn', { name });
    }
    if (game.status === 'won') return this.translation.t(this.isCurrentUserGameWinner(game)
      ? 'common.contact.chatroom.games.iWon'
      : 'common.contact.chatroom.games.iLost');
    return this.translation.t('common.contact.chatroom.games.drawTitle');
  }

  showGameState(game: ChatGame): void {
    this.snackBar.open(this.getGameStateLabel(game), '', { duration: 2200 });
  }

  getCurrentUserGamePieceLabel(game: ChatGame): TicTacToeMark | null {
    if (game.type === 'ticTacToe') return this.getTicTacToePlayerMark(game);
    if (game.type === 'dotsAndBoxes') {
      const currentUserId = this.userService.getUser().id;
      return game.playerXUserId === currentUserId ? 'X' : game.playerOUserId === currentUserId ? 'O' : null;
    }
    if (game.type === 'memory') {
      const currentUserId = this.userService.getUser().id;
      return game.playerXUserId === currentUserId ? 'X' : game.playerOUserId === currentUserId ? 'O' : null;
    }
    if(game.type==='morris'){
      const id=this.userService.getUser().id;return game.playerXUserId===id?'X':game.playerOUserId===id?'O':null;
    }
    if(game.type==='checkers'){const id=this.userService.getUser().id;return game.playerXUserId===id?'X':game.playerOUserId===id?'O':null}
    if(game.type==='asteroidDuel'){const id=this.userService.getUser().id;return game.playerXUserId===id?'X':game.playerOUserId===id?'O':null}
    if(game.type==='treasureMap')return null;
    if(game.type==='wordRescue')return null;
    if (game.type === 'minefield') {
      const currentUserId = this.userService.getUser().id;
      return game.playerXUserId === currentUserId ? 'X' : game.playerOUserId === currentUserId ? 'O' : null;
    }
    if (game.type === 'minefieldHideSeek') return null;
    if (game.type === 'rockPaperScissors' || game.type === 'code') return null;
    const currentUserId = this.userService.getUser().id;
    return game.playerRedUserId === currentUserId ? 'X' : game.playerYellowUserId === currentUserId ? 'O' : null;
  }

  openGameRules(game: ChatGame): void {
    this.matDialog.open(GameRulesDialogComponent, {
      data: {
        gameType: game.type,
        variant: game.type === 'dotsAndBoxes' || game.type === 'rockPaperScissors' || game.type === 'code' || game.type === 'memory' || game.type === 'minefield' || game.type === 'minefieldHideSeek'||game.type==='morris'||game.type==='checkers'||game.type==='asteroidDuel'||game.type==='treasureMap'||game.type==='wordRescue' ? 'standard' : game.variant ?? 'standard'
      },
      width: 'min(440px, 94vw)',
      maxWidth: '94vw',
      maxHeight: '85vh',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: false
    });
  }

  startGameRematch(game: ChatGame, message:ChatroomMessage): void {
    const contact = this.contact();
    if (!contact || contact.status === 'removed_by_contact') return;
    if (game.type === 'ticTacToe') {
      this.openNewTicTacToeDialog(contact, game.variant ?? 'standard', message.messageId);
    } else if (game.type === 'connectFour') {
      this.openNewConnectFourDialog(contact, game.variant ?? 'standard', message.messageId);
    } else if (game.type === 'dotsAndBoxes') {
      this.openNewDotsAndBoxesDialog(contact, message.messageId);
    } else if (game.type === 'rockPaperScissors') {
      this.openNewRockPaperScissorsDialog(contact, message.messageId);
    } else if (game.type === 'memory') {
      this.openNewMemoryDialog(contact, message.messageId);
    } else if (game.type === 'minefield') {
      this.openNewMinefieldDialog(contact, message.messageId);
    } else if (game.type === 'minefieldHideSeek') {
      this.openNewMinefieldHideSeekDialog(contact, message.messageId);
    }else if(game.type==='morris'){
      this.openNewMorrisDialog(contact,message.messageId);
    }else if(game.type==='checkers'){
      this.openNewCheckersDialog(contact,message.messageId);
    }else if(game.type==='asteroidDuel'){
      this.openNewAsteroidDuelDialog(contact,message.messageId);
    }else if(game.type==='treasureMap'){
      this.openNewTreasureMapDialog(contact,message.messageId);
    }else if(game.type==='wordRescue'){
      this.openNewWordRescueDialog(contact,message.messageId);
    } else {
      this.openNewCodeDialog(contact, message.messageId);
    }
  }

  canShowGameRematch(game:ChatGame):boolean{
    if(game.type==='minefieldHideSeek'){
      const ended=game.status!=='active'||game.phase==='placingSecond';
      return ended&&game.playerXUserId===this.userService.getUser().id;
    }
    return game.status!=='active';
  }

  canPlayMorris(message:ChatroomMessage):boolean{const g=message.payload?.game;return !!g&&g.type==='morris'&&g.status==='active'&&g.nextPlayerUserId===this.userService.getUser().id&&!this.gameMovesInFlight().has(g.gameId)}
  async playMorris(message:ChatroomMessage,action:MorrisAction):Promise<void>{const contact=this.contact(),g=message.payload?.game;if(!contact||!g||g.type!=='morris'||!this.canPlayMorris(message))return;const next=applyMorrisAction(g,this.userService.getUser().id,action);if(!next)return;this.setGameMoveInFlight(g.gameId,true);try{const payload=this.createEmptyMessage();payload.game=next;await this.sendAsNewMessage(contact,payload,message.messageId,'game_move')}finally{this.setGameMoveInFlight(g.gameId,false)}}
  canPlayCheckers(message:ChatroomMessage):boolean{const g=message.payload?.game;return !!g&&g.type==='checkers'&&g.status==='active'&&g.nextPlayerUserId===this.userService.getUser().id&&!this.gameMovesInFlight().has(g.gameId)}
  async playCheckers(message:ChatroomMessage,action:CheckersAction):Promise<void>{const contact=this.contact(),g=message.payload?.game;if(!contact||!g||g.type!=='checkers'||!this.canPlayCheckers(message))return;const next=applyCheckersMove(g,this.userService.getUser().id,action);if(!next)return;this.setGameMoveInFlight(g.gameId,true);try{const payload=this.createEmptyMessage();payload.game=next;await this.sendAsNewMessage(contact,payload,message.messageId,'game_move')}finally{this.setGameMoveInFlight(g.gameId,false)}}
  canPlayAsteroidDuel(message:ChatroomMessage):boolean{const g=message.payload?.game;return !!g&&g.type==='asteroidDuel'&&g.status==='active'&&g.nextPlayerUserId===this.userService.getUser().id&&!this.gameMovesInFlight().has(g.gameId)}
  async playAsteroidDuel(message:ChatroomMessage,action:AsteroidDuelAction):Promise<void>{const contact=this.contact(),g=message.payload?.game;if(!contact||!g||g.type!=='asteroidDuel'||!this.canPlayAsteroidDuel(message))return;const next=applyAsteroidDuelAction(g,this.userService.getUser().id,action);if(!next)return;this.setGameMoveInFlight(g.gameId,true);try{if(next.lastMove?.hitPlayer)this.rememberAsteroidHit(next);else if(next.lastMove?.destroyedAsteroid!==null)this.gameFeedback.notifyExplosion();const payload=this.createEmptyMessage();payload.game=next;await this.sendAsNewMessage(contact,payload,message.messageId,'game_move')}finally{this.setGameMoveInFlight(g.gameId,false)}}
  canPlayTreasureMap(message:ChatroomMessage):boolean{const g=message.payload?.game;return !!g&&g.type==='treasureMap'&&g.status==='active'&&g.phase==='active'&&g.nextPlayerUserId===this.userService.getUser().id&&!this.gameMovesInFlight().has(g.gameId)}
  async playTreasureMap(message:ChatroomMessage,action:TreasureMapAction):Promise<void>{const contact=this.contact(),g=message.payload?.game;if(!contact||!g||g.type!=='treasureMap'||!this.canPlayTreasureMap(message))return;const next=applyTreasureMapAction(g,this.userService.getUser().id,action);if(!next)return;this.setGameMoveInFlight(g.gameId,true);try{const found=next.lastMove?.foundItems??[];if(found.includes('bomb'))this.gameFeedback.notifyExplosion();else if(found.includes('bride'))this.gameFeedback.notifyTreasureCrown();else if(found.includes('treasure'))this.gameFeedback.notifyTreasureFound();else if(found.includes('map')||found.includes('compass'))this.gameFeedback.notifyTreasureClue();else if(found.includes('wine'))this.gameFeedback.notifyIncorrect();else if(found.includes('prisoner'))this.gameFeedback.notifyCorrect();else this.gameFeedback.notifySelection();const payload=this.createEmptyMessage();payload.game=next;await this.sendAsNewMessage(contact,payload,message.messageId,'game_move')}finally{this.setGameMoveInFlight(g.gameId,false)}}
  canPlayWordRescue(message:ChatroomMessage):boolean{const g=message.payload?.game;return !!g&&g.type==='wordRescue'&&g.status==='active'&&g.nextPlayerUserId===this.userService.getUser().id&&!this.gameMovesInFlight().has(g.gameId)}
  async playWordRescue(message:ChatroomMessage,action:WordRescueAction):Promise<void>{const contact=this.contact(),g=message.payload?.game;if(!contact||!g||g.type!=='wordRescue'||!this.canPlayWordRescue(message))return;const next=applyWordRescueAction(g,this.userService.getUser().id,action);if(!next)return;this.setGameMoveInFlight(g.gameId,true);try{if(next.status==='won'&&next.winnerUserId===g.guesserUserId)this.gameFeedback.notifyCorrect();else if(next.wrongCount>g.wrongCount)this.gameFeedback.notifyIncorrect();else this.gameFeedback.notifyCorrect();const payload=this.createEmptyMessage();payload.game=next;await this.sendAsNewMessage(contact,payload,message.messageId,'game_move')}finally{this.setGameMoveInFlight(g.gameId,false)}}
  async startTreasureMapPlanning(message:ChatroomMessage):Promise<void>{const contact=this.contact(),currentPayload=message.payload,g=currentPayload?.game,userId=this.userService.getUser().id;if(!contact||!currentPayload||!g||g.type!=='treasureMap'||g.status!=='active'||g.phase!=='active'||g.nextPlayerUserId!==userId||g.planningPlayerUserId===userId||this.gameMovesInFlight().has(g.gameId))return;const next:TreasureMapGame={...g,planningPlayerUserId:userId},payload:ShortMessage={...currentPayload,game:next};this.setGameMoveInFlight(g.gameId,true);try{const encrypted=await this.contactMessageService.encryptMessageForContact(contact,payload);if(!this.isEncryptedMessageWithinLimit(encrypted.encryptedMessageForUser,encrypted.encryptedMessageForContact))throw new Error('message_too_large');await firstValueFrom(this.contactMessageService.updateMessage({messageId:message.messageId,contactId:contact.id,userId:contact.userId,contactUserId:contact.contactUserId,encryptedMessageForUser:encrypted.encryptedMessageForUser,encryptedMessageForContact:encrypted.encryptedMessageForContact,signature:encrypted.signature}));this.messages.update(messages=>messages.map(entry=>entry.messageId===message.messageId?{...entry,payload}:entry));void this.persistPayloadBatch(contact.id,[{messageId:message.messageId,payload}]);this.socketioService.sendUpdatedContactMessage({id:message.id,messageId:message.messageId,contactId:contact.id,userId:contact.userId,contactUserId:contact.contactUserId,messageSignature:encrypted.signature,userEncryptedMessage:encrypted.encryptedMessageForUser,contactUserEncryptedMessage:encrypted.encryptedMessageForContact,createdAt:new Date().toISOString()})}catch{this.snackBar.open(this.translation.t('common.contact.chatroom.sendFailed'),'',{duration:3000})}finally{this.setGameMoveInFlight(g.gameId,false)}}
  openTreasureMapPlacement(message:ChatroomMessage):void{const contact=this.contact(),g=message.payload?.game;if(!contact||!g||g.type!=='treasureMap'||g.phase!=='placingO'||g.nextPlayerUserId!==this.userService.getUser().id)return;const ref=this.matDialog.open(NewTreasureMapDialogComponent,{width:'min(520px,96vw)',maxWidth:'96vw',maxHeight:'90vh',hasBackdrop:true,backdropClass:'dialog-backdrop',autoFocus:false});ref.afterClosed().subscribe(async(layout?:(TreasureIslandItem|null)[])=>{if(!layout)return;const next=placeTreasureMapOpponent(g,this.userService.getUser().id,layout);if(!next)return;this.setGameMoveInFlight(g.gameId,true);try{const payload=this.createEmptyMessage();payload.game=next;await this.sendAsNewMessage(contact,payload,message.messageId,'game_move')}finally{this.setGameMoveInFlight(g.gameId,false)}})}

  canPlayCode(message: ChatroomMessage): boolean {
    const game = message.payload?.game;
    return !!game && game.type === 'code' && game.status === 'active'
      && game.nextPlayerUserId === this.userService.getUser().id
      && !this.gameMovesInFlight().has(game.gameId);
  }

  canPlayMemory(message: ChatroomMessage): boolean {
    const game = message.payload?.game;
    return !!game && game.type === 'memory' && game.status === 'active'
      && game.nextPlayerUserId === this.userService.getUser().id
      && !this.gameMovesInFlight().has(game.gameId);
  }

  canPlayMinefield(message: ChatroomMessage): boolean {
    const game = message.payload?.game;
    return !!game && game.type === 'minefield' && game.status === 'active'
      && game.nextPlayerUserId === this.userService.getUser().id
      && !this.gameMovesInFlight().has(game.gameId);
  }

  canPlayMinefieldHideSeek(message: ChatroomMessage): boolean {
    const game = message.payload?.game;
    return !!game && game.type === 'minefieldHideSeek' && game.status === 'active'
      && game.nextPlayerUserId === this.userService.getUser().id
      && !this.gameMovesInFlight().has(game.gameId);
  }

  canToggleMinefieldLayout(game: ChatGame): boolean {
    if (game.type !== 'minefieldHideSeek' || game.status !== 'active'
      || (game.phase !== 'searchingFirst' && game.phase !== 'searchingSecond')) return false;
    return currentHideSeekRound(game)?.hiderUserId === this.userService.getUser().id;
  }

  isMinefieldLayoutVisible(gameId: string): boolean {
    return this.visibleMinefieldLayouts().has(gameId);
  }

  toggleMinefieldLayout(gameId: string): void {
    this.visibleMinefieldLayouts.update(current => {
      const next = new Set(current);
      if (next.has(gameId)) next.delete(gameId); else next.add(gameId);
      return next;
    });
  }

  async playMinefieldHideSeekMove(message: ChatroomMessage, cellIndex: number): Promise<void> {
    const game = message.payload?.game;
    if (!game || game.type !== 'minefieldHideSeek') return;
    const next = applyHideSeekSearch(game, this.userService.getUser().id, cellIndex);
    if (next) await this.sendMinefieldHideSeekRevision(message, next);
  }

  async placeSecondMinefield(message: ChatroomMessage, indices: number[]): Promise<void> {
    const game = message.payload?.game;
    if (!game || game.type !== 'minefieldHideSeek') return;
    const next = applySecondMinePlacement(game, this.userService.getUser().id, indices);
    if (next) await this.sendMinefieldHideSeekRevision(message, next);
  }

  private async sendMinefieldHideSeekRevision(message: ChatroomMessage, game: MinefieldHideSeekGame): Promise<void> {
    const contact = this.contact(); if (!contact || !this.canPlayMinefieldHideSeek(message)) return;
    this.setGameMoveInFlight(game.gameId, true);
    try { const payload = this.createEmptyMessage(); payload.game = game; await this.sendAsNewMessage(contact, payload, message.messageId, 'game_move'); }
    finally { this.setGameMoveInFlight(game.gameId, false); }
  }

  async playMinefieldMove(message: ChatroomMessage, cellIndex: number): Promise<void> {
    const contact = this.contact();
    const game = message.payload?.game;
    if (!contact || !game || game.type !== 'minefield' || !this.canPlayMinefield(message)) return;
    const nextGame = applyMinefieldMove(game, this.userService.getUser().id, cellIndex);
    if (!nextGame) return;
    this.setGameMoveInFlight(game.gameId, true);
    try {
      const payload = this.createEmptyMessage();
      payload.game = nextGame;
      await this.sendAsNewMessage(contact, payload, message.messageId, 'game_move');
    } finally {
      this.setGameMoveInFlight(game.gameId, false);
    }
  }

  getMinefieldStatusText(game: MinefieldGame): string {
    const currentUserId = this.userService.getUser().id;
    const contactName = this.contact()?.name || this.translation.t('common.contact.chatroom.contactLabel');
    if (game.status === 'draw') return this.translation.t('common.contact.chatroom.games.statusDraw');
    if (game.status === 'won') return game.winnerUserId === currentUserId
      ? this.translation.t('common.contact.chatroom.games.statusWonYou')
      : this.translation.t('common.contact.chatroom.games.statusWonContact', { name: contactName });
    return game.nextPlayerUserId === currentUserId
      ? this.translation.t('common.contact.chatroom.games.statusYourTurn')
      : this.translation.t('common.contact.chatroom.games.statusContactTurn', { name: contactName });
  }

  async playMemoryTurn(message: ChatroomMessage, cardIndices: [number, number]): Promise<void> {
    const contact = this.contact();
    const game = message.payload?.game;
    if (!contact || !game || game.type !== 'memory' || !this.canPlayMemory(message)) return;
    const nextGame = applyMemoryTurn(game, this.userService.getUser().id, cardIndices);
    if (!nextGame) return;
    this.setGameMoveInFlight(game.gameId, true);
    const payload = this.createEmptyMessage();
    payload.game = nextGame;
    await this.sendAsNewMessage(contact, payload, message.messageId, 'game_move');
    this.setGameMoveInFlight(game.gameId, false);
  }

  getMemoryStatusText(game: MemoryGame): string {
    const currentUserId = this.userService.getUser().id;
    const contactName = this.contact()?.name || this.translation.t('common.contact.chatroom.contactLabel');
    if (game.status === 'draw') return this.translation.t('common.contact.chatroom.games.statusDraw');
    if (game.status === 'won') return game.winnerUserId === currentUserId
      ? this.translation.t('common.contact.chatroom.games.statusWonYou')
      : this.translation.t('common.contact.chatroom.games.statusWonContact', { name: contactName });
    return game.nextPlayerUserId === currentUserId
      ? this.translation.t('common.contact.chatroom.games.statusYourTurn')
      : this.translation.t('common.contact.chatroom.games.statusContactTurn', { name: contactName });
  }

  async submitCodeGuess(message: ChatroomMessage, symbols: CodeSymbol[]): Promise<void> {
    const contact = this.contact();
    const game = message.payload?.game;
    if (!contact || !game || game.type !== 'code' || !this.canPlayCode(message)) return;
    if (!game.encryptedSecretForCodeBreaker) return;
    this.setGameMoveInFlight(game.gameId, true);
    try {
      const decrypted = await this.cryptoService.decrypt(
        this.userService.getUser().cryptoKeyPair.privateKey,
        JSON.parse(game.encryptedSecretForCodeBreaker) as CryptoData
      );
      const secret = JSON.parse(decrypted) as CodeSecret;
      if (!isValidCode(secret.code) || await createCodeCommitment(secret) !== game.commitment) throw new Error('invalid_commitment');
      const nextGame = submitAndEvaluateCodeGuess(game, this.userService.getUser().id, symbols, secret);
      if (!nextGame) return;
      if (nextGame.status === 'won' && nextGame.winnerUserId === game.codeBreakerUserId) {
        this.gameFeedback.notifyCorrect();
      } else {
        this.gameFeedback.notifyIncorrect();
      }
      const payload = this.createEmptyMessage();
      payload.game = nextGame;
      await this.sendAsNewMessage(contact, payload, message.messageId, 'game_move');
    } catch {
      this.snackBar.open(this.translation.t('common.contact.chatroom.games.codeEvaluationFailed'), '', { duration: 3000 });
    } finally {
      this.setGameMoveInFlight(game.gameId, false);
    }
  }

  async evaluateCodeGuess(message: ChatroomMessage): Promise<void> {
    const contact = this.contact();
    const game = message.payload?.game;
    if (!contact || !game || game.type !== 'code' || !this.canPlayCode(message)) return;
    this.setGameMoveInFlight(game.gameId, true);
    try {
      const decrypted = await this.cryptoService.decrypt(
        this.userService.getUser().cryptoKeyPair.privateKey,
        JSON.parse(game.encryptedSecret) as CryptoData
      );
      const secret = JSON.parse(decrypted) as CodeSecret;
      if (!isValidCode(secret.code) || await createCodeCommitment(secret) !== game.commitment) throw new Error('invalid_commitment');
      const nextGame = evaluateCodeGuess(game, this.userService.getUser().id, secret);
      if (!nextGame) return;
      const payload = this.createEmptyMessage();
      payload.game = nextGame;
      await this.sendAsNewMessage(contact, payload, message.messageId, 'game_move');
    } catch {
      this.snackBar.open(this.translation.t('common.contact.chatroom.games.codeEvaluationFailed'), '', { duration: 3000 });
    } finally {
      this.setGameMoveInFlight(game.gameId, false);
    }
  }

  canPlayConnectFour(message: ChatroomMessage): boolean {
    const game = message.payload?.game;
    return !!game
      && game.type === 'connectFour'
      && !this.gameMovesInFlight().has(game.gameId)
      && game.status === 'active'
      && game.nextPlayerUserId === this.userService.getUser().id;
  }

  canPlayDotsAndBoxes(message: ChatroomMessage): boolean {
    const game = message.payload?.game;
    return !!game
      && game.type === 'dotsAndBoxes'
      && !this.gameMovesInFlight().has(game.gameId)
      && game.status === 'active'
      && game.nextPlayerUserId === this.userService.getUser().id;
  }

  canPlayRockPaperScissors(message: ChatroomMessage): boolean {
    const game = message.payload?.game;
    return !!game
      && game.type === 'rockPaperScissors'
      && !this.gameMovesInFlight().has(game.gameId)
      && game.status === 'active'
      && game.nextPlayerUserId === this.userService.getUser().id;
  }

  async playRockPaperScissorsChoice(message: ChatroomMessage, choice: RockPaperScissorsChoice): Promise<void> {
    const contact = this.contact();
    const game = message.payload?.game;
    if (!contact || !game || game.type !== 'rockPaperScissors' || !this.canPlayRockPaperScissors(message)) return;
    const nextGame = applyRockPaperScissorsChoice(game, this.userService.getUser().id, choice);
    if (!nextGame) return;
    this.setGameMoveInFlight(game.gameId, true);
    const payload = this.createEmptyMessage();
    payload.game = nextGame;
    await this.sendAsNewMessage(contact, payload, message.messageId, 'game_move');
    this.setGameMoveInFlight(game.gameId, false);
  }

  getRockPaperScissorsChoiceLabel(game: RockPaperScissorsGame): string {
    const currentUserId = this.userService.getUser().id;
    const choice = game.playerXUserId === currentUserId ? game.playerXChoice : game.playerOChoice;
    return choice ? this.translation.t(`common.contact.chatroom.games.${choice}`) : '';
  }

  async playDotsAndBoxesMove(message: ChatroomMessage, move: DotsAndBoxesMove): Promise<void> {
    const contact = this.contact();
    const game = message.payload?.game;
    if (!contact || !game || game.type !== 'dotsAndBoxes' || !this.canPlayDotsAndBoxes(message)) return;
    const nextGame = applyDotsAndBoxesMove(game, this.userService.getUser().id, move);
    if (!nextGame) return;
    this.setGameMoveInFlight(game.gameId, true);
    const payload = this.createEmptyMessage();
    payload.game = nextGame;
    await this.sendAsNewMessage(contact, payload, message.messageId, 'game_move');
    this.setGameMoveInFlight(game.gameId, false);
  }

  async playConnectFourMove(message: ChatroomMessage, column: number): Promise<void> {
    const contact = this.contact();
    const game = message.payload?.game;
    if (!contact || !game || game.type !== 'connectFour' || !this.canPlayConnectFour(message)) return;
    const nextGame = applyConnectFourMove(game, this.userService.getUser().id, column);
    if (!nextGame) return;
    this.setGameMoveInFlight(game.gameId, true);
    const payload = this.createEmptyMessage();
    payload.game = nextGame;
    await this.sendAsNewMessage(contact, payload, message.messageId, 'game_move');
    this.setGameMoveInFlight(game.gameId, false);
  }

  async playTicTacToeMove(message: ChatroomMessage, cellIndex: number): Promise<void> {
    const contact = this.contact();
    const game = message.payload?.game;
    if (!contact || !game || game.type !== 'ticTacToe' || !this.canPlayTicTacToe(message)) {
      return;
    }
    const nextGame = applyTicTacToeMove(game, this.userService.getUser().id, cellIndex);
    if (!nextGame) {
      return;
    }

    this.setGameMoveInFlight(game.gameId, true);
    const payload = this.createEmptyMessage();
    payload.game = nextGame;
    await this.sendAsNewMessage(contact, payload, message.messageId, 'game_move');
    this.setGameMoveInFlight(game.gameId, false);
  }

  getTicTacToeStatusText(game: TicTacToeGame): string {
    const currentUserId = this.userService.getUser().id;
    const contactName = this.contact()?.name || this.translation.t('common.contact.chatroom.contactLabel');
    if (game.status === 'draw') {
      return this.translation.t('common.contact.chatroom.games.statusDraw');
    }
    if (game.status === 'won') {
      return game.winnerUserId === currentUserId
        ? this.translation.t('common.contact.chatroom.games.statusWonYou')
        : this.translation.t('common.contact.chatroom.games.statusWonContact', { name: contactName });
    }
    return game.nextPlayerUserId === currentUserId
      ? this.translation.t('common.contact.chatroom.games.statusYourTurn')
      : this.translation.t('common.contact.chatroom.games.statusContactTurn', { name: contactName });
  }

  getConnectFourStatusText(game: ConnectFourGame): string {
    const currentUserId = this.userService.getUser().id;
    const contactName = this.contact()?.name || this.translation.t('common.contact.chatroom.contactLabel');
    if (game.status === 'draw') return this.translation.t('common.contact.chatroom.games.statusDraw');
    if (game.status === 'won') {
      return game.winnerUserId === currentUserId
        ? this.translation.t('common.contact.chatroom.games.statusWonYou')
        : this.translation.t('common.contact.chatroom.games.statusWonContact', { name: contactName });
    }
    return game.nextPlayerUserId === currentUserId
      ? this.translation.t('common.contact.chatroom.games.statusYourTurn')
      : this.translation.t('common.contact.chatroom.games.statusContactTurn', { name: contactName });
  }

  getDotsAndBoxesStatusText(game: DotsAndBoxesGame): string {
    const currentUserId = this.userService.getUser().id;
    const contactName = this.contact()?.name || this.translation.t('common.contact.chatroom.contactLabel');
    if (game.status === 'draw') return this.translation.t('common.contact.chatroom.games.statusDraw');
    if (game.status === 'won') {
      return game.winnerUserId === currentUserId
        ? this.translation.t('common.contact.chatroom.games.statusWonYou')
        : this.translation.t('common.contact.chatroom.games.statusWonContact', { name: contactName });
    }
    return game.nextPlayerUserId === currentUserId
      ? this.translation.t('common.contact.chatroom.games.statusYourTurn')
      : this.translation.t('common.contact.chatroom.games.statusContactTurn', { name: contactName });
  }

  getRockPaperScissorsStatusText(game: RockPaperScissorsGame): string {
    const currentUserId = this.userService.getUser().id;
    const contactName = this.contact()?.name || this.translation.t('common.contact.chatroom.contactLabel');
    if (game.status === 'draw') return this.translation.t('common.contact.chatroom.games.statusDraw');
    if (game.status === 'won') {
      return game.winnerUserId === currentUserId
        ? this.translation.t('common.contact.chatroom.games.statusWonYou')
        : this.translation.t('common.contact.chatroom.games.statusWonContact', { name: contactName });
    }
    return game.nextPlayerUserId === currentUserId
      ? this.translation.t('common.contact.chatroom.games.statusYourTurn')
      : this.translation.t('common.contact.chatroom.games.statusContactTurn', { name: contactName });
  }

  private setGameMoveInFlight(gameId: string, inFlight: boolean): void {
    this.gameMovesInFlight.update((current) => {
      const next = new Set(current);
      if (inFlight) {
        next.add(gameId);
      } else {
        next.delete(gameId);
      }
      return next;
    });
  }

  private getTicTacToeStats(variant: TicTacToeVariant): TicTacToeStats {
    const currentUserId = this.userService.getUser().id;
    const latestGames = new Map<string, TicTacToeGame>();
    for (const message of this.messages()) {
      const game = message.payload?.game;
      if (game?.type !== 'ticTacToe') continue;
      const gameVariant = game.variant ?? 'standard';
      if (gameVariant === variant && !latestGames.has(game.gameId)) {
        latestGames.set(game.gameId, game);
      }
    }

    const stats: TicTacToeStats = { played: latestGames.size, won: 0, lost: 0, drawn: 0 };
    for (const game of latestGames.values()) {
      if (game.status === 'draw') {
        stats.drawn += 1;
      } else if (game.status === 'won' && game.winnerUserId === currentUserId) {
        stats.won += 1;
      } else if (game.status === 'won') {
        stats.lost += 1;
      }
    }
    return stats;
  }

  private getConnectFourStats(variant: ConnectFourVariant): GameStats {
    const currentUserId = this.userService.getUser().id;
    const latestGames = new Map<string, ConnectFourGame>();
    for (const message of this.messages()) {
      const game = message.payload?.game;
      if (game?.type !== 'connectFour' || (game.variant ?? 'standard') !== variant) continue;
      if (!latestGames.has(game.gameId)) latestGames.set(game.gameId, game);
    }
    const stats: GameStats = { played: latestGames.size, won: 0, lost: 0, drawn: 0 };
    for (const game of latestGames.values()) {
      if (game.status === 'draw') stats.drawn += 1;
      else if (game.status === 'won' && game.winnerUserId === currentUserId) stats.won += 1;
      else if (game.status === 'won') stats.lost += 1;
    }
    return stats;
  }

  private getDotsAndBoxesStats(): GameStats {
    const currentUserId = this.userService.getUser().id;
    const latestGames = new Map<string, DotsAndBoxesGame>();
    for (const message of this.messages()) {
      const game = message.payload?.game;
      if (game?.type === 'dotsAndBoxes' && !latestGames.has(game.gameId)) latestGames.set(game.gameId, game);
    }
    const stats: GameStats = { played: latestGames.size, won: 0, lost: 0, drawn: 0 };
    for (const game of latestGames.values()) {
      if (game.status === 'draw') stats.drawn += 1;
      else if (game.status === 'won' && game.winnerUserId === currentUserId) stats.won += 1;
      else if (game.status === 'won') stats.lost += 1;
    }
    return stats;
  }

  private getRockPaperScissorsStats(): GameStats {
    const currentUserId = this.userService.getUser().id;
    const latestGames = new Map<string, RockPaperScissorsGame>();
    for (const message of this.messages()) {
      const game = message.payload?.game;
      if (game?.type === 'rockPaperScissors' && !latestGames.has(game.gameId)) latestGames.set(game.gameId, game);
    }
    const stats: GameStats = { played: latestGames.size, won: 0, lost: 0, drawn: 0 };
    for (const game of latestGames.values()) {
      if (game.status === 'draw') stats.drawn += 1;
      else if (game.status === 'won' && game.winnerUserId === currentUserId) stats.won += 1;
      else if (game.status === 'won') stats.lost += 1;
    }
    return stats;
  }

  private getCodeStats(): GameStats {
    const currentUserId = this.userService.getUser().id;
    const latestGames = new Map<string, CodeGame>();
    for (const message of this.messages()) {
      const game = message.payload?.game;
      if (game?.type === 'code' && !latestGames.has(game.gameId)) latestGames.set(game.gameId, game);
    }
    const stats: GameStats = { played: latestGames.size, won: 0, lost: 0, drawn: 0 };
    for (const game of latestGames.values()) {
      if (game.status === 'won' && game.winnerUserId === currentUserId) stats.won += 1;
      else if (game.status === 'won') stats.lost += 1;
    }
    return stats;
  }

  private getMemoryStats(): GameStats {
    const currentUserId = this.userService.getUser().id;
    const latestGames = new Map<string, MemoryGame>();
    for (const message of this.messages()) {
      const game = message.payload?.game;
      if (game?.type === 'memory' && !latestGames.has(game.gameId)) latestGames.set(game.gameId, game);
    }
    const stats: GameStats = { played: latestGames.size, won: 0, lost: 0, drawn: 0 };
    for (const game of latestGames.values()) {
      if (game.status === 'draw') stats.drawn += 1;
      else if (game.status === 'won' && game.winnerUserId === currentUserId) stats.won += 1;
      else if (game.status === 'won') stats.lost += 1;
    }
    return stats;
  }

  private getMinefieldStats(): GameStats {
    const currentUserId = this.userService.getUser().id;
    const latestGames = new Map<string, MinefieldGame>();
    for (const message of this.messages()) {
      const game = message.payload?.game;
      if (game?.type === 'minefield' && !latestGames.has(game.gameId)) latestGames.set(game.gameId, game);
    }
    const stats: GameStats = { played: latestGames.size, won: 0, lost: 0, drawn: 0 };
    for (const game of latestGames.values()) {
      if (game.status === 'draw') stats.drawn += 1;
      else if (game.status === 'won' && game.winnerUserId === currentUserId) stats.won += 1;
      else if (game.status === 'won') stats.lost += 1;
    }
    return stats;
  }

  private getMinefieldHideSeekStats(): GameStats {
    const currentUserId = this.userService.getUser().id;
    const latest = new Map<string, MinefieldHideSeekGame>();
    for (const message of this.messages()) { const game = message.payload?.game; if (game?.type === 'minefieldHideSeek' && !latest.has(game.gameId)) latest.set(game.gameId, game); }
    const stats: GameStats = { played: latest.size, won: 0, lost: 0, drawn: 0 };
    for(const game of latest.values()){
      const legacyRound=game.phase==='placingSecond'?game.rounds[0]:null;
      const winnerUserId=game.winnerUserId??(legacyRound?(legacyRound.lost?legacyRound.hiderUserId:legacyRound.seekerUserId):null);
      if(game.status==='draw')stats.drawn++;
      else if((game.status==='won'||!!legacyRound)&&winnerUserId===currentUserId)stats.won++;
      else if(game.status==='won'||!!legacyRound)stats.lost++;
    }
    return stats;
  }

  private getMorrisStats():GameStats{
    const current=this.userService.getUser().id,latest=new Map<string,MorrisGame>();
    for(const message of this.messages()){const game=message.payload?.game;if(game?.type==='morris'&&!latest.has(game.gameId))latest.set(game.gameId,game)}
    const stats:GameStats={played:latest.size,won:0,lost:0,drawn:0};
    for(const game of latest.values()){if(game.status==='draw')stats.drawn++;else if(game.status==='won'&&game.winnerUserId===current)stats.won++;else if(game.status==='won')stats.lost++}return stats;
  }
  private getCheckersStats():GameStats{const current=this.userService.getUser().id,latest=new Map<string,CheckersGame>();for(const message of this.messages()){const game=message.payload?.game;if(game?.type==='checkers'&&!latest.has(game.gameId))latest.set(game.gameId,game)}const stats:GameStats={played:latest.size,won:0,lost:0,drawn:0};for(const game of latest.values()){if(game.status==='draw')stats.drawn++;else if(game.status==='won'&&game.winnerUserId===current)stats.won++;else if(game.status==='won')stats.lost++}return stats}
  private getAsteroidDuelStats():GameStats{const current=this.userService.getUser().id,latest=new Map<string,AsteroidDuelGame>();for(const message of this.messages()){const game=message.payload?.game;if(game?.type==='asteroidDuel'&&!latest.has(game.gameId))latest.set(game.gameId,game)}const stats:GameStats={played:latest.size,won:0,lost:0,drawn:0};for(const game of latest.values()){if(game.status==='won'&&game.winnerUserId===current)stats.won++;else if(game.status==='won')stats.lost++}return stats}
  private getTreasureMapStats():GameStats{const current=this.userService.getUser().id,latest=new Map<string,TreasureMapGame>();for(const message of this.messages()){const game=message.payload?.game;if(game?.type==='treasureMap'&&!latest.has(game.gameId))latest.set(game.gameId,game)}const stats:GameStats={played:latest.size,won:0,lost:0,drawn:0};for(const game of latest.values()){if(game.status==='draw')stats.drawn++;else if(game.status==='won'&&game.winnerUserId===current)stats.won++;else if(game.status==='won')stats.lost++}return stats}
  private getWordRescueStats():GameStats{const current=this.userService.getUser().id,latest=new Map<string,WordRescueGame>();for(const message of this.messages()){const game=message.payload?.game;if(game?.type==='wordRescue'&&!latest.has(game.gameId))latest.set(game.gameId,game)}const stats:GameStats={played:latest.size,won:0,lost:0,drawn:0};for(const game of latest.values()){if(game.status==='won'&&game.winnerUserId===current)stats.won++;else if(game.status==='won')stats.lost++}return stats}

  openExperienceSearch(message?: ChatroomMessage): void {
    if (!this.externalContentConsent.isEnabled('viator')) {
      this.externalContentConsent.request('viator').subscribe((enabled) => {
        if (enabled) this.openExperienceSearch(message);
      });
      return;
    }
    const contact = this.contact();
    if (!contact) {
      return;
    }
    const initialTerm = message?.payload?.experience
      ? (message.payload.experienceSearchTerm
        || message.payload.experience.title
        || message.payload.experience.productCode
        || '')
      : '';
    const dialogRef = this.matDialog.open(ExperienceSearchComponent, {
      data: message?.payload?.experience
        ? { source: 'chat', initialTerm, autoSearch: true }
        : { source: 'chat' },
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
      const searchTerm = dialogRef.componentInstance.getChatSearchTerm();
      if (message) {
        this.sendEditedExperienceMessage(contact, message, result, searchTerm);
      } else {
        this.sendExperienceMessage(contact, result, searchTerm);
      }
      dialogRef.close(result);
    });

    dialogRef.afterClosed().subscribe(() => subscription.unsubscribe());
  }

  openSavedExperiencePicker(message?: ChatroomMessage): void {
    const contact = this.contact();
    if (!contact) {
      return;
    }
    const dialogRef = this.matDialog.open(ContactChatroomExperienceSelectDialogComponent, {
      width: 'min(420px, 92vw)',
      maxWidth: '92vw',
      maxHeight: '80vh',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: false
    });

    dialogRef.afterClosed().subscribe((experience?: ExperienceResult) => {
      if (!experience) {
        return;
      }
      if (message) {
        this.sendEditedExperienceMessage(contact, message, experience);
        return;
      }
      this.sendExperienceMessage(contact, experience);
    });
  }

  prepareExperienceEdit(message: ChatroomMessage): void {
    this.experienceEditTarget.set(message);
  }

  clearExperienceEditTarget(): void {
    this.experienceEditTarget.set(null);
  }

  editSelectedExperienceFromSaved(): void {
    const message = this.experienceEditTarget();
    if (!message) {
      return;
    }
    this.openSavedExperiencePicker(message);
  }

  editSelectedExperienceSearch(): void {
    const message = this.experienceEditTarget();
    if (!message) {
      return;
    }
    this.openExperienceSearch(message);
  }

  private sendExperienceMessage(contact: Contact, experience: ExperienceResult, experienceSearchTerm?: string | null): void {
    const payload = this.createEmptyMessage();
    payload.experience = experience;
    payload.experienceSearchTerm = experienceSearchTerm ?? null;
    void this.sendAsNewMessage(contact, payload);
  }

  private sendEditedExperienceMessage(
    contact: Contact,
    message: ChatroomMessage,
    experience: ExperienceResult,
    experienceSearchTerm?: string | null
  ): void {
    const payload: ShortMessage = message.payload
      ? {
        ...message.payload,
        experience,
        experienceSearchTerm: experienceSearchTerm ?? null
      }
      : {
        ...this.createEmptyMessage(),
        experience,
        experienceSearchTerm: experienceSearchTerm ?? null
      };
    void this.sendAsNewMessage(contact, payload, message.messageId);
  }

  openAudioRecorder(initialAudio?: ShortMessage['audio'] | null, revisionOfMessageId?: string): void {
    const contact = this.contact();
    if (!contact) {
      return;
    }
    if (this.audioLimitReached()) {
      this.snackBar.open(this.translation.t('common.contact.chatroom.audioLimitReached'), '', { duration: 3000 });
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
      void this.sendAsNewMessage(contact, payload, revisionOfMessageId);
    });
  }

  hasContent(message?: ShortMessage): boolean {
    return !!message && (
      message.message?.trim() !== ''
      || message.multimedia?.type !== 'undefined'
      || !!message.location
      || !!message.experience
      || !!message.game
      || !!message.audio
    );
  }

  hasTabbedMultimediaContent(message: ShortMessage): boolean {
    const hasMultimediaContent = message.multimedia?.type !== 'undefined' || !!message.location;
    return hasMultimediaContent && message.message.trim() !== '';
  }

  shouldUseTabbedMultimediaContent(message: ChatroomMessage): boolean {
    return !!message.payload
      && this.tabbedMessageIds.has(message.messageId)
      && this.hasTabbedMultimediaContent(message.payload);
  }

  getMultimediaTabIcon(message: ShortMessage): string {
    return message.multimedia?.type !== 'undefined' ? 'perm_media' : 'place';
  }

  getMultimediaTabLabel(message: ShortMessage): string {
    const key = message.multimedia?.type !== 'undefined'
      ? 'common.contact.chatroom.multimediaTabAria'
      : 'common.contact.chatroom.locationTabAria';
    return this.translation.t(key);
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
    this.ensureAudioDuration(cacheKey, blob);
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
      const cachedDuration = this.audioDurationCache.get(messageId) ?? 0;
      this.playbackFallbackDuration = cachedDuration || ((message.payload?.audio?.durationMs ?? 0) / 1000);
      const duration = Number.isFinite(this.audioPlayer.duration) && this.audioPlayer.duration > 0
        ? this.audioPlayer.duration
        : this.playbackFallbackDuration;
      const atEnd = Number.isFinite(duration) && duration > 0
        ? (this.audioPlayer.currentTime >= duration - 0.05)
        : (this.audioProgress()[messageId] ?? 0) >= 1;
      if (this.audioPlayer.ended || atEnd) {
        this.audioPlayer.currentTime = 0;
      }
      this.playbackStartedAt = performance.now();
      this.playbackStartedOffset = this.audioPlayer.currentTime || 0;
      this.setAudioProgress(messageId, 0.001);
      void this.audioPlayer.play();
      this.startPlaybackProgress(messageId, message.payload?.audio?.durationMs);
    } else {
      this.audioPlayer.pause();
      this.stopPlaybackProgress();
    }
  }

  isAudioPlaying(message: ChatroomMessage): boolean {
    const messageId = message.messageId || message.id;
    return this.playingMessageId === messageId && !!this.audioPlayer && !this.audioPlayer.paused;
  }

  getAudioBars(message: ChatroomMessage): AudioWaveBar[] {
    const waveform = message.payload?.audio?.waveform ?? [];
    const totalBars = waveform.length;
    if (!totalBars) {
      return [];
    }
    const messageId = message.messageId || message.id;
    const isActive = this.playingMessageId === messageId;
    if (!isActive) {
      const startIndex = Math.max(0, totalBars - this.audioWaveWindow);
      const bars: AudioWaveBar[] = [];
      for (let i = 0; i < this.audioWaveWindow; i += 1) {
        const sourceIndex = startIndex + i;
        const value = waveform[sourceIndex] ?? 0.2;
        bars.push({ value, active: false });
      }
      return bars;
    }
    const progress = this.audioProgress()[messageId] ?? 0;
    const currentIndex = Math.min(totalBars - 1, Math.floor(progress * totalBars));
    const bars: AudioWaveBar[] = [];
    for (let i = 0; i < this.audioWaveWindow; i += 1) {
      const offset = this.audioWaveWindow - 1 - i;
      const sourceIndex = currentIndex - offset;
      if (sourceIndex < 0 || sourceIndex >= totalBars) {
        bars.push({ value: this.clearedWaveValue, active: false });
        continue;
      }
      const value = waveform[sourceIndex] ?? 0.2;
      bars.push({ value, active: sourceIndex === currentIndex && currentIndex >= 0 });
    }
    return bars;
  }

  formatAudioDuration(durationMs?: number): string {
    if (!durationMs || durationMs <= 0) {
      return '';
    }
    const totalSeconds = Math.round(durationMs / 1000);
    return this.formatSeconds(totalSeconds);
  }

  getAudioTimer(message: ChatroomMessage): string {
    const durationMs = message.payload?.audio?.durationMs;
    const messageId = message.messageId || message.id;
    const isActive = this.playingMessageId === messageId;
    const playerDuration = isActive && Number.isFinite(this.audioPlayer?.duration)
      ? (this.audioPlayer?.duration ?? 0)
      : 0;
    const cachedDuration = this.audioDurationCache.get(messageId) ?? 0;
    const totalSeconds = playerDuration > 0
      ? Math.round(playerDuration)
      : (cachedDuration || (durationMs && durationMs > 0 ? Math.max(1, Math.round(durationMs / 1000)) : 0));
    if (!totalSeconds) {
      return '--:--';
    }
    if (!isActive) {
      return this.formatSeconds(totalSeconds);
    }
    const progress = this.audioProgress()[messageId] ?? 0;
    const elapsedSeconds = Math.min(totalSeconds, Math.round(totalSeconds * progress));
    return `${this.formatSeconds(elapsedSeconds)} / ${this.formatSeconds(totalSeconds)}`;
  }

  private formatSeconds(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  private ensureAudioDuration(cacheKey: string, blob: Blob): void {
    if (this.audioDurationCache.has(cacheKey) || this.audioDurationPending.has(cacheKey)) {
      return;
    }
    this.audioDurationPending.add(cacheKey);
    this.computeAudioDuration(blob)
      .then((durationSeconds) => {
        if (durationSeconds > 0) {
          this.audioDurationCache.set(cacheKey, durationSeconds);
        }
      })
      .finally(() => {
        this.audioDurationPending.delete(cacheKey);
      });
  }

  private async computeAudioDuration(blob: Blob): Promise<number> {
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const audioContext = new (window.AudioContext || (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext!)();
      const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));
      const duration = Number.isFinite(decoded.duration) ? decoded.duration : 0;
      await audioContext.close();
      return duration > 0 ? Math.round(duration) : 0;
    } catch {
      return 0;
    }
  }

  waveHeight(value: number): number {
    if (!Number.isFinite(value)) {
      return 20;
    }
    return Math.max(20, Math.round(value * 100));
  }

  private startPlaybackProgress(messageId: string, fallbackDurationMs?: number): void {
    this.stopPlaybackProgress();
    const fallbackDuration = (fallbackDurationMs ?? 0) / 1000;
    this.playbackTimer = setInterval(() => {
      if (!this.audioPlayer || !this.playingMessageId || this.playingMessageId !== messageId) {
        this.stopPlaybackProgress();
        return;
      }
      const duration = Number.isFinite(this.audioPlayer.duration) && this.audioPlayer.duration > 0
        ? this.audioPlayer.duration
        : (this.playbackFallbackDuration || fallbackDuration);
      if (!Number.isFinite(duration) || duration <= 0) {
        return;
      }
      const elapsed = (performance.now() - this.playbackStartedAt) / 1000 + this.playbackStartedOffset;
      const currentTime = this.audioPlayer.currentTime || 0;
      const effectiveTime = Math.max(currentTime, elapsed);
      const progress = Math.min(1, Math.max(0, effectiveTime / duration));
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
        this.persistPayloadFromState(message.messageId);
        void this.persistTranslation(message.messageId, translated);
      },
      error: (err) => {
        const errorMessage = this.translateService.getErrorMessage(err)
          ?? this.translation.t('common.contact.chatroom.translateFailed');
        this.snackBar.open(errorMessage, '', { duration: 3000 });
      }
    });
  }

  toggleReadAloud(message: ChatroomMessage): void {
    if (!this.speechService.supported()) {
      this.showReadAloudHint('common.speech.unsupported');
      return;
    }

    if (!this.appService.getAppSettings().speech?.enabled) {
      this.showReadAloudHint('common.speech.disabled');
      return;
    }

    const text = this.getSpeechText(message);
    if (!text) {
      return;
    }

    this.speechService.toggle({
      targetId: this.getSpeechTargetId(message),
      text,
      lang: this.shouldPreferTranslatedSpeech(message) ? this.languageService.effectiveLanguage() : undefined
    });
  }

  isReadAloudActive(message: ChatroomMessage): boolean {
    return this.speechService.isActive(this.getSpeechTargetId(message));
  }

  getReadAloudIcon(message: ChatroomMessage): string {
    return this.isReadAloudActive(message) ? 'stop' : 'volume_up';
  }

  getReadAloudLabel(message: ChatroomMessage): string {
    return this.translation.t(
      this.isReadAloudActive(message)
        ? 'common.actions.stopReadAloud'
        : 'common.actions.readAloud'
    );
  }

  private getSpeechTargetId(message: ChatroomMessage): string {
    return `contact-chatroom:${message.messageId}`;
  }

  private shouldPreferTranslatedSpeech(message: ChatroomMessage): boolean {
    return message.direction === 'contactUser'
      && this.appService.getAppSettings().speech?.preferTranslatedText !== false
      && !!message.payload?.translatedMessage
      && !message.showOriginal;
  }

  private getSpeechText(message: ChatroomMessage): string {
    if (this.shouldPreferTranslatedSpeech(message)) {
      return (message.payload?.translatedMessage ?? '').trim();
    }
    return (message.payload?.message ?? '').trim();
  }

  private showReadAloudHint(messageKey: string): void {
    this.matDialog.open(DisplayMessage, {
      closeOnNavigation: false,
      data: {
        showAlways: true,
        title: this.translation.t('common.actions.readAloud'),
        image: '',
        icon: 'record_voice_over',
        message: this.translation.t(messageKey),
        button: this.translation.t('common.actions.ok'),
        delay: 0,
        showSpinner: false,
        autoclose: false
      },
      maxWidth: '90vw',
      maxHeight: '90vh',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: false
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
      this.openAudioRecorder(message.payload.audio, message.messageId);
      return;
    }
    if (message.payload?.experience) {
      this.openExperienceSearch(message);
      return;
    }
    const initialPayload: ShortMessage = message.payload
      ? structuredClone(message.payload)
      : this.createEmptyMessage();

    const dialogRef = this.matDialog.open(ContactEditMessageComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: { mode: Mode.EDIT_SHORT_MESSAGE, contact, shortMessage: initialPayload },
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
      void this.sendAsNewMessage(contact, result.shortMessage, message.messageId);
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
          void this.contactMessageService.deleteLocalPayload(_message.messageId);
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

  finalizeOptimisticMessage(
    tempMessageId: string,
    serverRecordId: string,
    sharedMessageId: string,
    createdAt?: string
  ): void {
    this.messages.update((msgs) =>
      msgs.map((msg) =>
        msg.messageId === tempMessageId
          ? {
            ...msg,
            id: serverRecordId,
            messageId: sharedMessageId,
            createdAt: createdAt ?? msg.createdAt
          }
          : msg
      )
    );
  }

  private loadMessages(force = false): void {
    const contact = this.contact();
    if (!contact) return;
    this.runPayloadSync(contact.id);
    const newContact = this.currentContactId !== contact.id;
    if (force || newContact) {
      this.currentContactId = contact.id;
      this.messageKeys.clear();
      this.messages.set([]);
      this.scrolledToFirstUnread = false;
      this.readTrackingEnabled = false;
      this.lastLiveMessageId = undefined;
      this.loaded.set(false);
      this.initialFocusHandled = false;
    }
    this.loading.set(true);
    this.contactMessageService.list(contact.id, { limit: 200 })
      .subscribe({
        next: async (res) => {
          // Merge with already present (live/optimistic) messages so we do not drop them while loading
          const merged = new Map<string, ChatroomMessage>(
            this.messages().map((msg) => [msg.messageId, msg])
          );
          const payloadsToPersist: PersistedPayloadEntry[] = [];
          for (const msg of res.rows ?? []) {
            const { payload, needsPayloadAck } = await this.resolveMessagePayload(contact, msg);
            if (payload && needsPayloadAck) {
              payloadsToPersist.push({ messageId: msg.messageId, payload });
            }
            const key = this.buildMessageKey(msg.id, msg.signature, msg.message ?? '');
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
          if (!this.initialTabbedMessagesCaptured) {
            mergedMessages
              .filter((message) => message.status === 'read' || !!message.readAt)
              .forEach((message) => this.tabbedMessageIds.add(message.messageId));
            this.initialTabbedMessagesCaptured = true;
          }
          this.messages.set(mergedMessages);
          if (payloadsToPersist.length > 0) {
            void this.persistPayloadBatch(contact.id, payloadsToPersist);
          }
          this.loading.set(false);
          this.loaded.set(true);
          setTimeout(() => this.scrollToInitialTarget(), 0);
        },
        error: () => {
          this.loading.set(false);
          this.loaded.set(true);
        }
      });
  }

  private runPayloadSync(contactId: string): void {
    if (!contactId || this.payloadSyncInFlightContacts.has(contactId)) {
      return;
    }
    this.payloadSyncInFlightContacts.add(contactId);

    void (async () => {
      try {
        const since = await this.contactMessageService.getPayloadSyncCursor(contactId);
        const syncResult = await firstValueFrom(this.contactMessageService.syncPayloadState(contactId, since));
        const purgedMessageIds = [...new Set((syncResult.purgedMessageIds ?? [])
          .map((id) => (typeof id === 'string' ? id.trim() : ''))
          .filter(Boolean))];

        if (purgedMessageIds.length > 0) {
          const purgedSet = new Set(purgedMessageIds);
          this.messages.update((msgs) => msgs.filter((msg) => !purgedSet.has(msg.messageId)));
          await Promise.all(purgedMessageIds.map((messageId) =>
            this.contactMessageService.deleteLocalPayload(messageId).catch(() => undefined)
          ));
        }

        const nextCursorRaw = syncResult.nextCursor;
        const nextCursor = Number.isFinite(nextCursorRaw) ? Math.max(since, Math.floor(nextCursorRaw)) : since;
        if (nextCursor !== since) {
          await this.contactMessageService.setPayloadSyncCursor(contactId, nextCursor);
        }
      } catch {
        // Sync is best effort. Local fallback remains functional.
      } finally {
        this.payloadSyncInFlightContacts.delete(contactId);
      }
    })();
  }

  private async resolveMessagePayload(contact: Contact, msg: ContactMessage): Promise<{ payload: ShortMessage | null; needsPayloadAck: boolean }> {
    const hasServerPayload = !!msg.message?.trim();
    if (hasServerPayload) {
      const decrypted = await this.contactMessageService.decryptAndVerify(contact, msg);
      if (decrypted) {
        return { payload: decrypted, needsPayloadAck: true };
      }
    }
    const cachedPayload = await this.contactMessageService.getLocalPayload(msg.messageId);
    return { payload: cachedPayload, needsPayloadAck: false };
  }

  private async persistPayloadBatch(contactId: string, entries: PersistedPayloadEntry[]): Promise<void> {
    if (!contactId || entries.length === 0) {
      return;
    }
    const uniqueEntries = new Map<string, ShortMessage>();
    entries.forEach((entry) => {
      if (!entry.messageId || !entry.payload) {
        return;
      }
      uniqueEntries.set(entry.messageId, entry.payload);
    });
    if (uniqueEntries.size === 0) {
      return;
    }
    const ackMessageIds: string[] = [];
    for (const [messageId, payload] of uniqueEntries.entries()) {
      try {
        await this.contactMessageService.storeLocalPayload(messageId, payload);
        ackMessageIds.push(messageId);
      } catch {
        // Ignore cache write errors; message still remains on server until next successful ack.
      }
    }
    if (ackMessageIds.length === 0) {
      return;
    }
    this.contactMessageService.ackPayloadStored({
      contactId,
      messageIds: ackMessageIds
    }).subscribe({
      error: () => {
        // Best effort. If this fails, next sync/list call can retry.
      }
    });
  }

  private persistPayloadFromState(messageId: string): void {
    if (!messageId) {
      return;
    }
    const payload = this.messages().find((msg) => msg.messageId === messageId)?.payload;
    if (!payload) {
      return;
    }
    void this.contactMessageService.storeLocalPayload(messageId, payload);
  }

  private scrollToFirstUnread(): void {
    if (this.scrolledToFirstUnread) {
      return;
    }
    const rows = this.messageRows?.toArray() ?? [];
    if (!rows.length) {
      if (this.visibleMessages().length === 0) {
        this.scrolledToFirstUnread = true;
        this.readTrackingEnabled = true;
      }
      return;
    }
    // Messages are sorted newest first; find the oldest unread (last in the list)
    let target: ElementRef<HTMLElement> | undefined;
    for (let i = rows.length - 1; i >= 0; i -= 1) {
      const message = this.visibleMessages()[i];
      if (message && this.isUnread(message)) {
        target = rows[i];
        break;
      }
    }
    if (target?.nativeElement && this.messageScroll?.nativeElement) {
      // Place the unread message fully in view (top aligned)
      const container = this.messageScroll.nativeElement;
      this.scrollElementToTop(container, target.nativeElement);
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

  private scrollToInitialTarget(): void {
    if (this.initialFocusHandled) {
      if (!this.scrolledToFirstUnread) {
        this.scrollToFirstUnread();
      }
      return;
    }

    this.initialFocusHandled = true;
    if (this.focusMessageId && this.scrollToMessage(this.focusMessageId)) {
      this.scrolledToFirstUnread = true;
      this.readTrackingEnabled = true;
      this.observeUnread();
      return;
    }

    this.scrollToFirstUnread();
  }

  private scrollToMessage(messageId: string): boolean {
    if (!messageId) {
      return false;
    }

    const rows = this.messageRows?.toArray() ?? [];
    const target = rows.find((row) => row.nativeElement.dataset['messageId'] === messageId);
    const container = this.messageScroll?.nativeElement;
    if (!target?.nativeElement || !container) {
      return false;
    }

    this.scrollElementToTop(container, target.nativeElement, 12);
    target.nativeElement.focus?.({ preventScroll: true });
    return true;
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
          if (!hasSufficientMessageVisibility(entry, container.clientHeight)) {
            return;
          }
          const target = entry.target as HTMLElement;
          const messageId = target.dataset['messageId'];
          if (!messageId) {
            return;
          }
          const message = this.messages().find((m) => m.messageId === messageId);
          if (message && this.isUnread(message)) {
            this.getRevisionHistory(message)
              .filter((revision) => this.isUnread(revision))
              .forEach((revision) => this.markAsRead(revision.messageId, contact));
          }
        });
      }, { root: container, threshold: [...MESSAGE_READ_VISIBILITY_THRESHOLDS] });
    }

    const rows = this.messageRows?.toArray() ?? [];
    rows.forEach((row, index) => {
      const message = this.visibleMessages()[index];
      if (message && this.isUnread(message)) {
        this.visibilityObserver!.observe(row.nativeElement);
      } else {
        this.visibilityObserver?.unobserve(row.nativeElement);
      }
    });
  }

  private scrollElementToTop(container: HTMLElement, target: HTMLElement, margin = 0): void {
    const containerTop = container.getBoundingClientRect().top;
    const targetTop = target.getBoundingClientRect().top;
    container.scrollTop = Math.max(0, container.scrollTop + targetTop - containerTop - margin);
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
    const list = this.visibleMessages();
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

  getRevisionHistory(message: ChatroomMessage): ChatroomMessage[] {
    const messagesById = new Map(this.messages().map((entry) => [entry.messageId, entry]));
    const history: ChatroomMessage[] = [];
    const visited = new Set<string>();
    let current: ChatroomMessage | undefined = message;

    while (current && !visited.has(current.messageId)) {
      history.push(current);
      visited.add(current.messageId);
      const previousMessageId: string | undefined = current.payload?.revisionOfMessageId?.trim();
      current = previousMessageId ? messagesById.get(previousMessageId) : undefined;
    }

    return history;
  }

  hasRevisionHistory(message: ChatroomMessage): boolean {
    return !message.payload?.game && this.getRevisionHistory(message).length > 1;
  }

  openRevisionHistory(message: ChatroomMessage): void {
    const revisions: ContactMessageRevisionHistoryEntry[] = this.getRevisionHistory(message).map((revision) => ({
      messageId: revision.messageId,
      createdAt: revision.createdAt,
      payload: revision.payload,
      displayText: revision.direction === 'contactUser'
        ? (revision.payload?.translatedMessage || revision.payload?.message || '')
        : (revision.payload?.message || '')
    }));

    this.matDialog.open(ContactMessageRevisionHistoryComponent, {
      data: { revisions },
      width: 'min(560px, 95vw)',
      maxWidth: '95vw',
      maxHeight: '85vh',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: false
    });
  }

  private markAsRead(messageId: string, contact: Contact): void {
    if (this.readRequestsInFlight.has(messageId)) {
      return;
    }
    this.readRequestsInFlight.add(messageId);
    this.contactMessageService.markReadBothCopies({
      messageId,
      contactId: contact.id,
      userId: contact.userId,
      contactUserId: contact.contactUserId
    }).subscribe({
      next: () => {
        this.readRequestsInFlight.delete(messageId);
        const row = this.messageRows?.find((candidate) =>
          candidate.nativeElement.dataset['messageId'] === messageId
        );
        if (row) {
          this.visibilityObserver?.unobserve(row.nativeElement);
        }
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
      },
      error: () => {
        this.readRequestsInFlight.delete(messageId);
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

  private async sendAsNewMessage(
    contact: Contact,
    payload: ShortMessage,
    revisionOfMessageId?: string,
    notificationType?: ContactMessageNotificationType
  ): Promise<boolean> {
    if (contact.status === 'removed_by_contact') {
      this.snackBar.open(this.translation.t('common.contact.chatroom.contactRemovedSendBlocked'), '', { duration: 4000 });
      return false;
    }

    const versionedPayload: ShortMessage = revisionOfMessageId
      ? { ...payload, revisionOfMessageId }
      : payload;
    let encryptedMessageForUser = '';
    let encryptedMessageForContact = '';
    let signature = '';
    try {
      ({ encryptedMessageForUser, encryptedMessageForContact, signature } =
        await this.contactMessageService.encryptMessageForContact(contact, versionedPayload));
    } catch {
      this.snackBar.open(this.translation.t('common.contact.chatroom.sendFailed'), '', { duration: 3000 });
      return false;
    }

    if (!this.isEncryptedMessageWithinLimit(encryptedMessageForUser, encryptedMessageForContact)) {
      this.snackBar.open(this.translation.t('common.contact.chatroom.messageTooLarge'), '', { duration: 3000 });
      return false;
    }
    if (!this.isRequestWithinLimit(contact, encryptedMessageForUser, encryptedMessageForContact, signature, notificationType)) {
      this.snackBar.open(this.translation.t('common.contact.chatroom.messageTooLarge'), '', { duration: 3000 });
      return false;
    }

    const tempId = this.addOptimisticMessage(versionedPayload);

    try {
      const res = await firstValueFrom(this.contactMessageService.send({
        contactId: contact.id,
        userId: contact.userId,
        contactUserId: contact.contactUserId,
        direction: 'user',
        encryptedMessageForUser,
        encryptedMessageForContact,
        signature,
        notificationType
      }));
      if (tempId) {
        this.finalizeOptimisticMessage(tempId, res.messageId, res.sharedMessageId, res.createdAt);
      }
      void this.persistPayloadBatch(contact.id, [{ messageId: res.sharedMessageId, payload: versionedPayload }]);
      this.socketioService.sendContactMessage({
        id: res.mirrorMessageId ?? res.messageId,
        messageId: res.sharedMessageId,
        contactId: contact.id,
        userId: contact.userId,
        contactUserId: contact.contactUserId,
        messageSignature: signature,
        userEncryptedMessage: encryptedMessageForUser,
        contactUserEncryptedMessage: encryptedMessageForContact,
        createdAt: res.createdAt ?? new Date().toISOString()
      });
      return true;
    } catch (err: unknown) {
      if (tempId) {
        this.removeOptimisticMessage(tempId);
      }
      const httpError = err as { status?: number; error?: { error?: string } };
      const isTooLarge = httpError?.status === 413 || `${httpError?.error?.error ?? ''}`.includes('too_large');
      const errorMessage = isTooLarge
        ? this.translation.t('common.contact.chatroom.messageTooLarge')
        : (httpError?.error?.error ?? this.translation.t('common.contact.chatroom.sendFailed'));
      this.snackBar.open(errorMessage, '', { duration: 3000 });
      return false;
    }
  }

  private isEncryptedMessageWithinLimit(forUser: string, forContact: string): boolean {
    return this.utf8Size(forUser) <= this.maxEncryptedMessageBytes
      && this.utf8Size(forContact) <= this.maxEncryptedMessageBytes;
  }

  private isRequestWithinLimit(
    contact: Contact,
    forUser: string,
    forContact: string,
    signature: string,
    notificationType?: ContactMessageNotificationType
  ): boolean {
    const payload = {
      contactId: contact.id,
      userId: contact.userId,
      contactUserId: contact.contactUserId,
      direction: 'user',
      encryptedMessageForUser: forUser,
      encryptedMessageForContact: forContact,
      signature,
      notificationType
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
