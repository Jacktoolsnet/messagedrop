import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, OnDestroy, OnInit, signal, WritableSignal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoPipe } from '@jsverse/transloco';
import { MasonryItemDirective } from '../../directives/masonry-item.directive';
import { Location } from '../../interfaces/location';
import { Message } from '../../interfaces/message';
import { Mode } from '../../interfaces/mode';
import { MultimediaType } from '../../interfaces/multimedia-type';
import { Profile } from '../../interfaces/profile';
import { ShortNumberPipe } from '../../pipes/short-number.pipe';
import { DsaStatusService } from '../../services/dsa-status.service';
import { LanguageService } from '../../services/language.service';
import { MapService } from '../../services/map.service';
import { MessageService } from '../../services/message.service';
import { ProfileService } from '../../services/profile.service';
import { SharedContentService } from '../../services/shared-content.service';
import { TranslateService } from '../../services/translate.service';
import { TranslationHelperService } from '../../services/translation-helper.service';
import { UserService } from '../../services/user.service';
import { EditMessageComponent } from '../editmessage/edit-message.component';
import { DigitalServicesActReportDialogComponent } from '../legal/digital-services-act-report-dialog/digital-services-act-report-dialog.component';
import { DsaCaseDialogComponent } from '../legal/digital-services-act-report-dialog/dsa-case-dialog/dsa-case-dialog.component';
import { DeleteMessageComponent } from '../messagelist/delete-message/delete-message.component';
import { MessageProfileComponent } from '../messagelist/message-profile/message-profile.component';
import { ShowmultimediaComponent } from '../multimedia/showmultimedia/showmultimedia.component';
import { ShowmessageComponent } from '../showmessage/showmessage.component';
import { DisplayMessage } from '../utils/display-message/display-message.component';
import { HelpDialogService } from '../utils/help-dialog/help-dialog.service';

type ResolvedDsaStatus = 'RECEIVED' | 'UNDER_REVIEW' | 'DECIDED' | 'UNKNOWN';
type ModerationStatus = 'published' | 'review' | 'hidden';

@Component({
  selector: 'app-my-messagelist',
  imports: [
    ShowmessageComponent,
    ShowmultimediaComponent,
    ShortNumberPipe,
    MatBadgeModule,
    MatCardModule,
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatDialogActions,
    MatDialogContent,
    MatIcon,
    MatFormFieldModule,
    MatMenuModule,
    MatInputModule,
    MasonryItemDirective,
    TranslocoPipe
  ],
  templateUrl: './my-messagelist.component.html',
  styleUrl: './my-messagelist.component.css'
})
export class MyMessagelistComponent implements OnInit, OnDestroy {

  private static readonly DSA_NOTICE_STATUSES = new Set(['RECEIVED', 'UNDER_REVIEW', 'DECIDED']);
  private static readonly STATUS_LABELS: Record<'RECEIVED' | 'UNDER_REVIEW' | 'DECIDED' | 'UNKNOWN', string> = {
    RECEIVED: 'dsa.case.noticeStatus.received',
    UNDER_REVIEW: 'dsa.case.noticeStatus.underReview',
    DECIDED: 'dsa.case.noticeStatus.decided',
    UNKNOWN: 'dsa.case.statusUnavailable'
  };
  private static readonly STATUS_CLASS_SUFFIX: Record<'RECEIVED' | 'UNDER_REVIEW' | 'DECIDED' | 'UNKNOWN', string> = {
    RECEIVED: 'received',
    UNDER_REVIEW: 'under-review',
    DECIDED: 'decided',
    UNKNOWN: 'unknown'
  };

  private static readonly DSA_UNKNOWN = 'UNKNOWN' as const;

  private readonly dsaStatusCache = signal<Record<string, ResolvedDsaStatus>>({});
  private readonly pendingDsaTokens = new Set<string>();

  public readonly userService = inject(UserService);
  public readonly messageService = inject(MessageService);
  private readonly translateService = inject(TranslateService);
  private readonly mapService = inject(MapService);
  public readonly profileService = inject(ProfileService);
  private readonly sharedContentService = inject(SharedContentService);
  public readonly dialogRef = inject(MatDialogRef<MyMessagelistComponent>);
  private readonly matDialog = inject(MatDialog);
  public readonly messageDialog = this.matDialog;
  public readonly dialog = this.matDialog;
  private readonly snackBar = inject(MatSnackBar);
  private readonly translation = inject(TranslationHelperService);
  readonly help = inject(HelpDialogService);
  private readonly dsaStatusService = inject(DsaStatusService);
  private readonly languageService = inject(LanguageService);
  readonly data = inject<{ location: Location; messageSignal: WritableSignal<Message[]> }>(MAT_DIALOG_DATA);

  readonly messagesSignal = signal<Message[]>([]);
  readonly filteredMessagesSignal = computed(() => {
    return this.messagesSignal();
  });
  readonly selectedMessagesSignal = this.messageService.selectedMessagesSignal;
  readonly commentsSignal = computed(() => {
    const parentMessage = this.messageService.selectedMessagesSignal().at(-1);
    return parentMessage ? this.messageService.getCommentsSignalForMessage(parentMessage.uuid)() : [];
  });

  readonly currentParentSignal = computed(() =>
    this.messageService.selectedMessagesSignal().at(-1)
  );

  readonly commentCountsSignal = this.messageService.commentCountsSignal;
  readonly commentCountForMessage = (uuid: string) => computed(() =>
    this.commentCountsSignal()[uuid] || 0
  );
  readonly translationTargetLabel = computed(() =>
    this.translation.t(`common.languageNames.${this.languageService.effectiveLanguage()}`)
  );
  readonly listSize = computed(() => {
    if (this.messageService.selectedMessagesSignal().length > 0) {
      return this.commentsSignal().length;
    }
    return this.filteredMessagesSignal().length;
  });

  private clickedMessage: Message | undefined = undefined;

  public userProfile: Profile;
  public likeButtonColor = 'secondary';
  public dislikeButtonColor = 'secondary';
  public mode: typeof Mode = Mode;

  constructor() {
    this.userProfile = this.userService.getProfile();
    // If we come from a tile, seed the service with the tile messages
    // so create/delete/like operate on the same list.
    if (this.data.messageSignal) {
      this.messageService.setMessages(this.data.messageSignal());
    }

    // Ongoing sync: service -> local view, optionally back into the provided signal.
    effect(() => {
      const serviceMessages = this.messageService.messagesSignal();
      this.messagesSignal.set(serviceMessages);
      if (this.data.messageSignal) {
        this.data.messageSignal.set(serviceMessages);
      }
    });

    effect(() => {
      const tokens = new Set<string>();

      for (const msg of this.filteredMessagesSignal()) {
        if (msg.status === 'disabled' && msg.dsaStatusToken) {
          tokens.add(msg.dsaStatusToken);
        }
      }

      for (const msg of this.selectedMessagesSignal()) {
        if (msg.status === 'disabled' && msg.dsaStatusToken) {
          tokens.add(msg.dsaStatusToken);
        }
      }

      for (const msg of this.commentsSignal()) {
        if (msg.status === 'disabled' && msg.dsaStatusToken) {
          tokens.add(msg.dsaStatusToken);
        }
      }

      tokens.forEach(token => this.ensureDsaStatusLoaded(token));
    });

    effect(() => {
      const width = this.listSize() > 1 ? '95vw' : 'auto';
      this.dialogRef.updateSize(width);
    });
  }

  async ngOnInit() {
    await this.profileService.loadAllProfiles();
  }

  ngOnDestroy() {
    this.messageService.clearSelectedMessages();
  }

  getCommentBadge(uuid: string): number {
    const count = this.commentCountForMessage(uuid)() ?? 0;
    return count;
  }

  public goBack() {
    const selected = this.messageService.selectedMessagesSignal();
    if (selected.length > 1) {
      const newSelected = [...selected];
      newSelected.pop();

      // Refresh parent from signals so counts stay up to date.
      const parent = newSelected.at(-1);
      if (parent) {
        const updatedParent = this.findMessageInSignals(parent.uuid) || parent;
        newSelected[newSelected.length - 1] = updatedParent;
      }

      this.messageService.selectedMessagesSignal.set(newSelected);
    } else if (selected.length === 1) {
      this.messageService.selectedMessagesSignal.set([]);
    } else {
      this.dialogRef.close();
    }
  }

  private findMessageInSignals(uuid: string): Message | undefined {
    return (
      this.messageService.messagesSignal().find(m => m.uuid === uuid) ||
      Array.from(this.messageService.commentsSignals.values())
        .flatMap(signal => signal())
        .find(m => m.uuid === uuid)
    );
  }

  public flyTo(message: Message) {
    this.mapService.moveToWithZoom(message.location, 18);
    this.dialogRef.close();
  }

  public navigateToMessageLocation(message: Message) {
    this.messageService.navigateToMessageLocation(message);
  }

  public onMessageCardActivate(message: Message): void {
    const userId = this.userService.getUser().id;
    if (!userId || userId !== message.userId) {
      return;
    }
    if (!this.userService.hasJwt()) {
      if (!this.userService.isReady()) {
        this.editMessageAfterLoginClick(message);
      }
      return;
    }
    this.editMessageClick(message);
  }

  public likeMessageAfterLoginClick(message: Message) {
    this.clickedMessage = message;
    this.userService.loginWithBackend(this.likeMessage.bind(this))
  }

  public likeMessageClick(message: Message) {
    this.clickedMessage = message;
    this.likeMessage();
  }

  public likeMessage() {
    if (!this.userService.hasJwt()) {
      return;
    }
    if (undefined != this.clickedMessage) {
      this.messageService.likeToggle(this.clickedMessage, this.userService.getUser());
    }
  }

  public dislikeMessageAfterLoginClick(message: Message) {
    this.clickedMessage = message;
    this.userService.loginWithBackend(this.dislikeMessage.bind(this))
  }

  public dislikeMessageClick(message: Message) {
    this.clickedMessage = message;
    this.dislikeMessage();
  }

  public dislikeMessage() {
    if (!this.userService.hasJwt()) {
      return;
    }
    if (undefined != this.clickedMessage) {
      this.messageService.dislikeToggle(this.clickedMessage, this.userService.getUser());
    }
  }

  public dsaReportMessage(message: Message) {
    const dialogRef = this.dialog.open(DigitalServicesActReportDialogComponent, {
      data: { message, contentType: 'public message' },
      closeOnNavigation: true,
      autoFocus: false,
      maxHeight: '90vh',
      width: '800px',
      maxWidth: '90vw',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop-transparent',
      disableClose: true,
    });

    dialogRef.afterClosed().subscribe(result => {
      if (!result?.created) return;

      if (result?.token) {
        this.flagMessageLocally(message, result.token);
        this.snackBar.open(
          this.translation.t('common.messageList.blockedMarked'),
          this.translation.t('common.actions.ok'),
          { duration: 3000, verticalPosition: 'top' }
        );
      } else {
        this.removeMessageLocally(message);
        this.snackBar.open(
          this.translation.t('common.messageList.blockedRemoved'),
          this.translation.t('common.actions.ok'),
          { duration: 3000, verticalPosition: 'top' }
        );
      }
    });
  }

  public deleteMessageAfterLoginClick(message: Message) {
    this.clickedMessage = message;
    this.userService.loginWithBackend(this.deleteMessage.bind(this))
  }

  public deleteMessageClick(message: Message) {
    this.clickedMessage = message;
    this.deleteMessage();
  }

  public deleteMessage() {
    if (!this.userService.hasJwt()) {
      return;
    }
    if (this.clickedMessage) {
      const dialogRef = this.dialog.open(DeleteMessageComponent, {
        closeOnNavigation: true,
        hasBackdrop: true,
        backdropClass: 'dialog-backdrop-transparent',
        disableClose: true,
      });

      dialogRef.afterClosed().subscribe(result => {
        if (!result) return;

        const selected = this.messageService.selectedMessagesSignal();

        // 1. Delete
        this.messageService.deleteMessage(this.clickedMessage!);

        // 2. Check if the current level still has comments.
        const parentUuid = this.clickedMessage!.parentUuid;
        if (!parentUuid) return; // Root -> nothing to do.

        const commentsSignal = this.messageService.getCommentsSignalForMessage(parentUuid);
        const remainingComments = commentsSignal().filter(c => c.id !== this.clickedMessage!.id);

        if (remainingComments.length === 0) {
          // Go up one level.
          const newSelected = [...selected];
          newSelected.pop();
          this.messageService.selectedMessagesSignal.set(newSelected);
        }
      });
    }
  }

  private removeMessageLocally(message: Message) {
    const isRootMessage = this.messageService.messagesSignal().some(m => m.uuid === message.uuid);

    if (isRootMessage) {
      this.messageService.messagesSignal.update(messages => messages.filter(m => m.uuid !== message.uuid));
      this.messageService.selectedMessagesSignal.update(selected => selected.filter(m => m.uuid !== message.uuid));
      return;
    }

    if (message.parentUuid) {
      const commentsSignal = this.messageService.getCommentsSignalForMessage(message.parentUuid);
      commentsSignal.set(commentsSignal().filter(c => c.uuid !== message.uuid));

      this.messageService.commentCountsSignal.update(counts => ({
        ...counts,
        [message.parentUuid!]: Math.max((counts[message.parentUuid!] || 0) - 1, 0)
      }));
    }

    this.messageService.selectedMessagesSignal.update(selected => selected.filter(m => m.uuid !== message.uuid));
  }

  private flagMessageLocally(message: Message, token: string) {
    const mutate = (m: Message) => m.uuid === message.uuid ? { ...m, status: 'disabled', dsaStatusToken: token } : m;

    this.messageService.messagesSignal.update(messages => messages.map(mutate));
    this.messageService.selectedMessagesSignal.update(selected => selected.map(mutate));

    if (message.parentUuid) {
      const commentsSignal = this.messageService.getCommentsSignalForMessage(message.parentUuid);
      commentsSignal.set(commentsSignal().map(mutate));
    }
  }

  public openDsaStatus(message: Message) {
    if (!message.dsaStatusToken) return;
    this.ensureDsaStatusLoaded(message.dsaStatusToken);
    this.dialog.open(DsaCaseDialogComponent, {
      data: { token: message.dsaStatusToken, message },
      maxHeight: '90vh',
      minWidth: '700px',
      maxWidth: '95vw',
      autoFocus: false,
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop-transparent',
      disableClose: true,
    });
  }

  public getDsaStatusButtonClass(message: Message): Record<string, boolean> {
    const status = this.resolveDsaStatus(message);
    const suffix = MyMessagelistComponent.STATUS_CLASS_SUFFIX[status] ?? MyMessagelistComponent.STATUS_CLASS_SUFFIX.UNKNOWN;
    return {
      'dsa-status-button': true,
      [`dsa-status-${suffix}`]: true
    };
  }

  public getDsaStatusAriaLabel(message: Message): string {
    const status = this.resolveDsaStatus(message);
    const key = MyMessagelistComponent.STATUS_LABELS[status] ?? MyMessagelistComponent.STATUS_LABELS.UNKNOWN;
    const label = this.translation.t(key);
    return this.translation.t('dsa.case.statusAria', { status: label });
  }

  private resolveDsaStatus(message: Message): ResolvedDsaStatus {
    if (!message.dsaStatusToken) return MyMessagelistComponent.DSA_UNKNOWN;
    return this.dsaStatusCache()[message.dsaStatusToken] ?? MyMessagelistComponent.DSA_UNKNOWN;
  }

  private ensureDsaStatusLoaded(token: string): void {
    if (!token) return;
    const snapshot = this.dsaStatusCache();
    if (Object.prototype.hasOwnProperty.call(snapshot, token)) return;
    if (this.pendingDsaTokens.has(token)) return;

    this.pendingDsaTokens.add(token);
    this.dsaStatusService.getStatus(token).subscribe({
      next: resp => {
        const rawStatus = resp.notice?.status ?? (resp.entityType === 'signal' ? 'RECEIVED' : undefined);
        const status = this.normalizeDsaStatus(rawStatus);
        this.dsaStatusCache.update(map => ({
          ...map,
          [token]: status
        }));
      },
      error: () => {
        this.dsaStatusCache.update(map => ({
          ...map,
          [token]: MyMessagelistComponent.DSA_UNKNOWN
        }));
      },
      complete: () => {
        this.pendingDsaTokens.delete(token);
      }
    });
  }

  private normalizeDsaStatus(status: string | null | undefined): ResolvedDsaStatus {
    if (!status) return MyMessagelistComponent.DSA_UNKNOWN;
    const upper = status.toUpperCase();
    return MyMessagelistComponent.DSA_NOTICE_STATUSES.has(upper)
      ? upper as ResolvedDsaStatus
      : MyMessagelistComponent.DSA_UNKNOWN;
  }

  public isOwnPublicMessage(message: Message): boolean {
    return this.userService.getUser().id === message.userId && message.typ === 'public';
  }

  private resolveModerationStatus(message: Message): ModerationStatus {
    if (message.manualModerationDecision === 'rejected') {
      return 'hidden';
    }
    if (message.manualModerationDecision === 'approved') {
      return 'published';
    }
    if (message.status !== 'enabled') {
      return 'hidden';
    }
    if (message.aiModerationDecision === 'review') {
      return 'review';
    }
    return 'published';
  }

  private getModerationStatusLabel(status: ModerationStatus): string {
    const base = 'common.messageList.moderationStatus';
    if (status === 'published') return this.translation.t(`${base}.published`);
    if (status === 'review') return this.translation.t(`${base}.review`);
    return this.translation.t(`${base}.hidden`);
  }

  private formatModerationBool(value: boolean | null | undefined): string {
    if (value === null || value === undefined) return this.translation.t('common.unknown');
    return value ? this.translation.t('common.actions.yes') : this.translation.t('common.actions.no');
  }

  private formatModerationNumber(value: number | null | undefined): string {
    if (!Number.isFinite(value)) return this.translation.t('common.unknown');
    return Number(value).toFixed(3);
  }

  private formatModerationValue(value: string | null | undefined): string {
    const text = String(value ?? '').trim();
    return text ? text : this.translation.t('common.unknown');
  }

  private resolveModerationReason(message: Message): string {
    const base = 'common.messageList.moderationStatus';
    if (message.manualModerationReason) {
      return message.manualModerationReason;
    }
    if (message.manualModerationDecision) {
      return this.translation.t(`${base}.reasonManual`);
    }
    if (message.patternMatch) {
      return this.translation.t(`${base}.reasonPattern`);
    }
    if (message.aiModerationDecision === 'rejected') {
      return this.translation.t(`${base}.reasonAi`);
    }
    if (message.aiModerationDecision === 'review') {
      return this.translation.t(`${base}.reasonReview`);
    }
    return this.translation.t('common.unknown');
  }

  public getModerationStatusIcon(message: Message): string {
    if (!this.isOwnPublicMessage(message)) return 'public';
    const status = this.resolveModerationStatus(message);
    if (status === 'published') return 'public';
    if (status === 'review') return 'hourglass_top';
    return 'visibility_off';
  }

  public getModerationStatusColor(message: Message): 'primary' | 'accent' | 'warn' {
    const status = this.resolveModerationStatus(message);
    if (status === 'published') return 'primary';
    if (status === 'review') return 'accent';
    return 'warn';
  }

  public getModerationStatusAriaLabel(message: Message): string {
    const status = this.getModerationStatusLabel(this.resolveModerationStatus(message));
    const base = 'common.messageList.moderationStatus';
    return this.translation.t(`${base}.aria`, { status });
  }

  public openModerationStatus(message: Message): void {
    if (!this.isOwnPublicMessage(message)) return;
    const base = 'common.messageList.moderationStatus';
    const statusLabel = this.getModerationStatusLabel(this.resolveModerationStatus(message));
    const reason = this.resolveModerationReason(message);
    const lines = [
      `${this.translation.t(`${base}.status`)}: ${statusLabel}`,
      `${this.translation.t(`${base}.reason`)}: ${reason}`
    ];

    const detailLines = [];
    const hasAiDecision = message.aiModerationDecision !== null && message.aiModerationDecision !== undefined && message.aiModerationDecision !== '';
    const hasAiScore = message.aiModerationScore !== null && message.aiModerationScore !== undefined;
    const hasAiFlagged = message.aiModerationFlagged !== null && message.aiModerationFlagged !== undefined;
    if (hasAiDecision || hasAiScore || hasAiFlagged) {
      detailLines.push(`${this.translation.t(`${base}.aiDecision`)}: ${this.formatModerationValue(message.aiModerationDecision)}`);
      detailLines.push(`${this.translation.t(`${base}.aiScore`)}: ${this.formatModerationNumber(message.aiModerationScore)}`);
      detailLines.push(`${this.translation.t(`${base}.aiFlagged`)}: ${this.formatModerationBool(message.aiModerationFlagged)}`);
    }
    if (message.patternMatch !== null && message.patternMatch !== undefined) {
      detailLines.push(`${this.translation.t(`${base}.patternMatch`)}: ${this.formatModerationBool(message.patternMatch)}`);
    }
    if (message.manualModerationDecision || message.manualModerationReason) {
      detailLines.push(`${this.translation.t(`${base}.manualDecision`)}: ${this.formatModerationValue(message.manualModerationDecision)}`);
      detailLines.push(`${this.translation.t(`${base}.manualReason`)}: ${this.formatModerationValue(message.manualModerationReason)}`);
    }

    if (detailLines.length) {
      lines.push('');
      lines.push(this.translation.t(`${base}.details`));
      lines.push(...detailLines);
    }

    this.dialog.open(DisplayMessage, {
      closeOnNavigation: false,
      data: {
        showAlways: true,
        title: this.translation.t(`${base}.title`),
        image: '',
        icon: this.getModerationStatusIcon(message),
        message: lines.join('\n'),
        button: this.translation.t('common.actions.ok'),
        delay: 0,
        showSpinner: false
      },
      maxWidth: '90vw',
      maxHeight: '90vh',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop-transparent',
      disableClose: true,
      autoFocus: false
    });
  }

  public editMessageAfterLoginClick(message: Message) {
    this.clickedMessage = message;
    this.userService.loginWithBackend(this.editMessage.bind(this))
  }

  public editMessageClick(message: Message) {
    this.clickedMessage = message;
    this.editMessage();
  }

  public editMessage() {
    if (!this.userService.hasJwt()) {
      return;
    }
    if (this.clickedMessage) {
      if (this.clickedMessage.multimedia.type !== MultimediaType.UNDEFINED) {
        this.sharedContentService.addSharedContentToMessage(this.clickedMessage);
      }

      const dialogRef = this.messageDialog.open(EditMessageComponent, {
        panelClass: '',
        data: { mode: this.clickedMessage.parentId == null ? this.mode.EDIT_PUBLIC_MESSAGE : this.mode.EDIT_COMMENT, message: this.clickedMessage },
        closeOnNavigation: true,
        minWidth: '20vw',
        maxWidth: '90vw',
        maxHeight: '90vh',
        hasBackdrop: true,
        backdropClass: 'dialog-backdrop-transparent',
        disableClose: true,
        autoFocus: false
      });

      dialogRef.afterClosed().subscribe((result?: { mode: Mode; message: Message }) => {
        if (result?.message) {
          this.messageService.updateMessage(result.message);
        }
      });
    }
  }

  public editMessageUserProfile(message: Message) {

    let profile: Profile | undefined = this.profileService.getProfile(message.userId);

    if (!profile) {
      profile = { name: '', base64Avatar: '', defaultStyle: '' };
    }

    const dialogRef = this.dialog.open(MessageProfileComponent, {
      data: { profile, userId: message.userId },
      closeOnNavigation: true,
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop-transparent',
      disableClose: true,
    });

    dialogRef.afterClosed().subscribe(() => {
      if (profile) {
        this.profileService.setProfile(message.userId, profile);
      }
    });
  }

  public editMessageUserProfileAfterLogin(message: Message): void {
    this.userService.loginWithBackend(() => this.editMessageUserProfile(message));
  }

  public translateMessage(message: Message) {
    this.translateService.translate(message.message, this.languageService.effectiveLanguage(), false, message.uuid).subscribe({
      next: response => {
        if (response.status === 200) {
          message.translatedMessage = response.result?.text;
        }
      },
      error: err => {
        const errorMessage = err?.error?.error ?? this.translation.t('common.messageList.translateFailed');
        this.snackBar.open(errorMessage, '', { duration: 3000 });
      }
    });
  }

  addMessagDialog(): void {
    if (!this.userService.hasJwt()) {
      return;
    }
    const message: Message = {
      id: 0,
      uuid: crypto.randomUUID(),
      parentId: 0,
      parentUuid: '',
      typ: 'public',
      createDateTime: null,
      deleteDateTime: null,
      location: this.data.location,
      message: '',
      markerType: 'default',
      style: this.userService.getProfile().defaultStyle ?? '',
      views: 0,
      likes: 0,
      dislikes: 0,
      comments: [],
      commentsNumber: 0,
      status: 'enabled',
      userId: '',
      multimedia: {
        type: MultimediaType.UNDEFINED,
        url: '',
        sourceUrl: '',
        attribution: '',
        title: '',
        description: '',
        contentId: ''
      }
    };

    this.sharedContentService.addSharedContentToMessage(message);

    const dialogRef = this.messageDialog.open(EditMessageComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: { mode: this.mode.ADD_PUBLIC_MESSAGE, message },
      minWidth: '20vw',
      maxWidth: '90vw',
      maxHeight: '90vh',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop-transparent',
      disableClose: true,
      autoFocus: false
    });

    dialogRef.afterClosed().subscribe((result?: { mode: Mode; message: Message }) => {
      if (result?.message) {
        this.messageService.createMessage(result.message, this.userService.getUser());
      }
    });
  }

  public handleCommentAfterLoginClick(message: Message) {
    this.clickedMessage = message;
    if (this.getCommentBadge(message.uuid) === 0) {
      this.userService.loginWithBackend(this.handleComment.bind(this))
    } else {
      this.handleComment();
    }
  }

  public handleCommentClick(message: Message) {
    this.clickedMessage = message;
    this.handleComment();
  }

  public handleComment() {
    if (this.clickedMessage) {
      const commentsSignal = this.messageService.getCommentsSignalForMessage(this.clickedMessage.uuid);
      const comments = commentsSignal();

      // Falls noch keine Kommentare geladen → jetzt holen
      this.messageService.getCommentsForParentMessage(this.clickedMessage);

      // Immer die aktuelle Ebene (die Kinder) als neue Ebene im Stack speichern
      this.messageService.selectedMessagesSignal.set([...this.messageService.selectedMessagesSignal(), this.clickedMessage]);

      // Sonderfall: Noch keine Comments → Direkt einen Kommentar erstellen
      if (comments.length === 0 && this.clickedMessage.commentsNumber === 0) {
        if (this.userService.hasJwt()) {
          this.addComment(this.clickedMessage);
        }
      }
    }
  }

  public addCommentAfterLogin() {
    this.addComment(this.currentParentSignal()!)
  }

  public addComment(parentMessage: Message) {
    if (!this.userService.hasJwt()) {
      return;
    }
    const message: Message = {
      id: 0,
      uuid: crypto.randomUUID(),
      parentId: parentMessage.id,
      parentUuid: parentMessage.uuid,
      typ: 'public',
      createDateTime: null,
      deleteDateTime: null,
      location: parentMessage.location,
      message: '',
      markerType: 'none',
      style: this.userService.getProfile().defaultStyle ?? '',
      views: 0,
      likes: 0,
      dislikes: 0,
      comments: [],
      commentsNumber: 0,
      status: 'enabled',
      userId: '',
      multimedia: {
        type: MultimediaType.UNDEFINED,
        url: '',
        sourceUrl: '',
        attribution: '',
        title: '',
        description: '',
        contentId: ''
      }
    };

    this.sharedContentService.addSharedContentToMessage(message);

    const dialogRef = this.messageDialog.open(EditMessageComponent, {
      panelClass: '',
      data: { mode: this.mode.ADD_COMMENT, message },
      closeOnNavigation: true,
      minWidth: '20vw',
      maxWidth: '90vw',
      maxHeight: '90vh',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop-transparent',
      disableClose: true,
      autoFocus: false
    });

    dialogRef.afterClosed().subscribe((result?: { mode: Mode; message: Message }) => {
      if (result?.message) {
        this.messageService.createComment(result.message, this.userService.getUser(), false, true);
      }
    });
  }
}
