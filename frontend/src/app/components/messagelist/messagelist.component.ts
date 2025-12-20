import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, OnInit, signal, WritableSignal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MAT_DIALOG_DATA, MatDialog, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MasonryItemDirective } from '../../directives/masonry-item.directive';
import { Location } from '../../interfaces/location';
import { Message } from '../../interfaces/message';
import { Mode } from '../../interfaces/mode';
import { MultimediaType } from '../../interfaces/multimedia-type';
import { Profile } from '../../interfaces/profile';
import { ShortNumberPipe } from '../../pipes/short-number.pipe';
import { DsaStatusService } from '../../services/dsa-status.service';
import { MapService } from '../../services/map.service';
import { MessageService } from '../../services/message.service';
import { ProfileService } from '../../services/profile.service';
import { SharedContentService } from '../../services/shared-content.service';
import { TranslateService } from '../../services/translate.service';
import { UserService } from '../../services/user.service';
import { EditMessageComponent } from '../editmessage/edit-message.component';
import { DigitalServicesActReportDialogComponent } from '../legal/digital-services-act-report-dialog/digital-services-act-report-dialog.component';
import { DsaCaseDialogComponent } from '../legal/digital-services-act-report-dialog/dsa-case-dialog/dsa-case-dialog.component';
import { ShowmultimediaComponent } from '../multimedia/showmultimedia/showmultimedia.component';
import { ShowmessageComponent } from '../showmessage/showmessage.component';
import { DeleteMessageComponent } from './delete-message/delete-message.component';
import { MessageProfileComponent } from './message-profile/message-profile.component';

type ResolvedDsaStatus = 'RECEIVED' | 'UNDER_REVIEW' | 'DECIDED' | 'UNKNOWN';

@Component({
  selector: 'app-messagelist',
  imports: [
    ShowmessageComponent,
    ShowmultimediaComponent,
    ShortNumberPipe,
    MatBadgeModule,
    MatCardModule,
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatDialogContent,
    MatIcon,
    MatFormFieldModule,
    MatMenuModule,
    MatInputModule,
    MasonryItemDirective
  ],
  templateUrl: './messagelist.component.html',
  styleUrl: './messagelist.component.css'
})
export class MessagelistComponent implements OnInit {

  private static readonly DSA_NOTICE_STATUSES = new Set(['RECEIVED', 'UNDER_REVIEW', 'DECIDED']);
  private static readonly STATUS_LABELS: Record<'RECEIVED' | 'UNDER_REVIEW' | 'DECIDED' | 'UNKNOWN', string> = {
    RECEIVED: 'Notice received',
    UNDER_REVIEW: 'Under review',
    DECIDED: 'Decision available',
    UNKNOWN: 'Status unavailable'
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
  public readonly dialogRef = inject(MatDialogRef<MessagelistComponent>);
  private readonly matDialog = inject(MatDialog);
  public readonly messageDialog = this.matDialog;
  public readonly dialog = this.matDialog;
  private readonly snackBar = inject(MatSnackBar);
  private readonly dsaStatusService = inject(DsaStatusService);
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

  private clickedMessage: Message | undefined = undefined;

  public userProfile: Profile;
  public likeButtonColor = 'secondary';
  public dislikeButtonColor = 'secondary';
  public mode: typeof Mode = Mode;

  constructor() {
    this.userProfile = this.userService.getProfile();
    // Wenn wir aus einer Tile kommen, initial den Service mit den Tile-Messages seeden,
    // damit alle Service-Operationen (create/delete/like) auf derselben Liste arbeiten.
    if (this.data.messageSignal) {
      this.messageService.setMessages(this.data.messageSignal());
    }

    // Laufende Synchronisierung: Service -> lokale View, optional zurück in das übergebene Signal.
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
  }

  async ngOnInit() {
    await this.profileService.loadAllProfiles();
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

      // Hier: Parent aus dem Signal neu holen → damit counts aktuell sind
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
    if (!this.userService.isReady() && this.userService.getUser().id === message.userId) {
      this.editMessageAfterLoginClick(message);
      return;
    }
    this.editMessageClick(message);
  }

  public likeMessageAfterLoginClick(message: Message) {
    this.clickedMessage = message;
    this.userService.login(this.likeMessage.bind(this))
  }

  public likeMessageClick(message: Message) {
    this.clickedMessage = message;
    this.likeMessage();
  }

  public likeMessage() {
    if (undefined != this.clickedMessage) {
      this.messageService.likeToggle(this.clickedMessage, this.userService.getUser());
    }
  }

  public dislikeMessageAfterLoginClick(message: Message) {
    this.clickedMessage = message;
    this.userService.login(this.dislikeMessage.bind(this))
  }

  public dislikeMessageClick(message: Message) {
    this.clickedMessage = message;
    this.dislikeMessage();
  }

  public dislikeMessage() {
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
      hasBackdrop: true
    });

    dialogRef.afterClosed().subscribe(result => {
      if (!result?.created) return;

      if (result?.token) {
        this.flagMessageLocally(message, result.token);
        this.snackBar.open('The content was hidden and marked for review.', 'OK', {
          duration: 3000,
          verticalPosition: 'top'
        });
      } else {
        this.removeMessageLocally(message);
        this.snackBar.open('The content was hidden and removed from the view.', 'OK', {
          duration: 3000,
          verticalPosition: 'top'
        });
      }
    });
  }

  public deleteMessageAfterLoginClick(message: Message) {
    this.clickedMessage = message;
    this.userService.login(this.deleteMessage.bind(this))
  }

  public deleteMessageClick(message: Message) {
    this.clickedMessage = message;
    this.deleteMessage();
  }

  public deleteMessage() {
    if (this.clickedMessage) {
      const dialogRef = this.dialog.open(DeleteMessageComponent, {
        closeOnNavigation: true,
        hasBackdrop: true
      });

      dialogRef.afterClosed().subscribe(result => {
        if (!result) return;

        const selected = this.messageService.selectedMessagesSignal();

        // 1. Löschen
        this.messageService.deleteMessage(this.clickedMessage!);

        // 2. Prüfen, ob in der aktuellen Ebene noch Comments da sind
        const parentUuid = this.clickedMessage!.parentUuid;
        if (!parentUuid) return; // Root → nichts zu tun

        const commentsSignal = this.messageService.getCommentsSignalForMessage(parentUuid);
        const remainingComments = commentsSignal().filter(c => c.id !== this.clickedMessage!.id);

        if (remainingComments.length === 0) {
          // Eine Ebene zurückgehen
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
      autoFocus: false
    });
  }

  public getDsaStatusButtonClass(message: Message): Record<string, boolean> {
    const status = this.resolveDsaStatus(message);
    const suffix = MessagelistComponent.STATUS_CLASS_SUFFIX[status] ?? MessagelistComponent.STATUS_CLASS_SUFFIX.UNKNOWN;
    return {
      'dsa-status-button': true,
      [`dsa-status-${suffix}`]: true
    };
  }

  public getDsaStatusAriaLabel(message: Message): string {
    const status = this.resolveDsaStatus(message);
    return `Moderation status: ${MessagelistComponent.STATUS_LABELS[status] ?? MessagelistComponent.STATUS_LABELS.UNKNOWN}`;
  }

  private resolveDsaStatus(message: Message): ResolvedDsaStatus {
    if (!message.dsaStatusToken) return MessagelistComponent.DSA_UNKNOWN;
    return this.dsaStatusCache()[message.dsaStatusToken] ?? MessagelistComponent.DSA_UNKNOWN;
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
          [token]: MessagelistComponent.DSA_UNKNOWN
        }));
      },
      complete: () => {
        this.pendingDsaTokens.delete(token);
      }
    });
  }

  private normalizeDsaStatus(status: string | null | undefined): ResolvedDsaStatus {
    if (!status) return MessagelistComponent.DSA_UNKNOWN;
    const upper = status.toUpperCase();
    return MessagelistComponent.DSA_NOTICE_STATUSES.has(upper)
      ? upper as ResolvedDsaStatus
      : MessagelistComponent.DSA_UNKNOWN;
  }

  public editMessageAfterLoginClick(message: Message) {
    this.clickedMessage = message;
    this.userService.login(this.editMessage.bind(this))
  }

  public editMessageClick(message: Message) {
    this.clickedMessage = message;
    this.editMessage();
  }

  public editMessage() {
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
        autoFocus: false
      });

      dialogRef.afterClosed().subscribe(() => {
        this.messageService.updateMessage(this.clickedMessage!);
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
      hasBackdrop: true
    });

    dialogRef.afterClosed().subscribe(() => {
      if (profile) {
        this.profileService.setProfile(message.userId, profile);
      }
    });
  }

  public translateMessage(message: Message) {
    this.translateService.translate(message.message, this.userService.getUser().language).subscribe({
      next: response => {
        if (response.status === 200) {
          message.translatedMessage = response.result?.text;
        }
      },
      error: err => {
        this.snackBar.open(err.error.error, '', { duration: 3000 });
      }
    });
  }

  addMessagDialog(): void {
    const message: Message = {
      id: 0,
      uuid: crypto.randomUUID(),
      parentId: 0,
      parentUuid: '',
      typ: 'public',
      createDateTime: '',
      deleteDateTime: '',
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
      this.userService.login(this.handleComment.bind(this))
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
        if (this.userService.isReady()) {
          this.addComment(this.clickedMessage);
        }
      }
    }
  }

  public addCommentAfterLogin() {
    this.addComment(this.currentParentSignal()!)
  }

  public addComment(parentMessage: Message) {
    const message: Message = {
      id: 0,
      uuid: crypto.randomUUID(),
      parentId: parentMessage.id,
      parentUuid: parentMessage.uuid,
      typ: 'public',
      createDateTime: '',
      deleteDateTime: '',
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
      autoFocus: false
    });

    dialogRef.afterClosed().subscribe((result?: { mode: Mode; message: Message }) => {
      if (result?.message) {
        this.messageService.createComment(result.message, this.userService.getUser());
      }
    });
  }
}
