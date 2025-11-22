import { CommonModule } from '@angular/common';
import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, QueryList, ViewChild, ViewChildren, computed, effect, inject, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { Contact } from '../../interfaces/contact';
import { Mode } from '../../interfaces/mode';
import { MultimediaType } from '../../interfaces/multimedia-type';
import { ShortMessage } from '../../interfaces/short-message';
import { ContactMessageService } from '../../services/contact-message.service';
import { ContactService } from '../../services/contact.service';
import { SocketioService } from '../../services/socketio.service';
import { UserService } from '../../services/user.service';
import { ContactEditMessageComponent } from '../contact/contact-edit-message/contact-edit-message.component';
import { ShowmultimediaComponent } from '../multimedia/showmultimedia/showmultimedia.component';
import { ShowmessageComponent } from '../showmessage/showmessage.component';
import { EmoticonPickerComponent } from '../utils/emoticon-picker/emoticon-picker.component';
import { DeleteContactMessageComponent } from './delete-contact-message/delete-contact-message.component';

type ChatroomMessage = {
  id: string;
  messageId: string;
  direction: 'user' | 'contactUser';
  payload: ShortMessage | null;
  createdAt: string;
  readAt?: string | null;
  status?: string;
  reaction?: string | null;
};

@Component({
  selector: 'app-contact-message-chatroom',
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIcon,
    ShowmultimediaComponent,
    ShowmessageComponent
  ],
  templateUrl: './contact-message-chatroom.component.html',
  styleUrl: './contact-message-chatroom.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ContactMessageChatroomComponent implements AfterViewInit {
  private readonly userService = inject(UserService);
  private readonly socketioService = inject(SocketioService);
  private readonly contactService = inject(ContactService);
  private readonly contactMessageService = inject(ContactMessageService);
  private readonly matDialog = inject(MatDialog);
  private readonly dialogRef = inject(MatDialogRef<ContactMessageChatroomComponent>);
  private readonly contactId = inject<string>(MAT_DIALOG_DATA);

  @ViewChild('messageScroll') private messageScroll?: ElementRef<HTMLElement>;
  @ViewChildren('messageRow') private messageRows?: QueryList<ElementRef<HTMLElement>>;

  readonly contact = computed(() =>
    this.contactService.sortedContactsSignal().find(contact => contact.id === this.contactId)
  );
  readonly composeMessage = output<Contact>();
  readonly messages = signal<ChatroomMessage[]>([]);
  readonly loading = signal<boolean>(false);
  readonly loaded = signal<boolean>(false);
  private readonly messageKeys = new Set<string>();
  private scrolledToFirstUnread = false;
  private readTrackingEnabled = false;
  private visibilityObserver?: IntersectionObserver;
  private currentContactId?: string;
  private lastLiveMessageId?: string;
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

  private readonly liveMessagesEffect = effect(async () => {
    const incoming = this.contactMessageService.liveMessages();
    const contact = this.contact();
    if (!incoming || !contact || incoming.contactId !== contact.id) {
      return;
    }
    const key = this.buildMessageKey(incoming.id, incoming.signature, incoming.encryptedMessage);
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
        reaction: incoming.reaction
      }, ...msgs]);
      this.lastLiveMessageId = incoming.id;
    }
  }, { allowSignalWrites: true });

  private readonly loadMessagesEffect = effect(() => {
    const contact = this.contact();
    if (contact && !this.loaded()) {
      this.loadMessages();
    }
  }, { allowSignalWrites: true });

  private readonly observeUnreadEffect = effect(() => {
    void this.messages();
    if (!this.readTrackingEnabled) {
      return;
    }
    queueMicrotask(() => this.observeUnread());
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
  }, { allowSignalWrites: true });

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
  }, { allowSignalWrites: true });

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

  ngAfterViewInit(): void {
    this.contactMessageService.initLiveReceive();
    this.loadMessages(true);
  }

  get profile() {
    return this.userService.getProfile();
  }

  canCompose(): boolean {
    return this.socketioService.isReady();
  }

  closeChatroom(): void {
    this.dialogRef.close();
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
      autoFocus: false
    });

    dialogRef.afterClosed().subscribe((result?: { shortMessage: ShortMessage }) => {
      if (!result?.shortMessage) {
        return;
      }
      void this.sendAsNewMessage(currentContact, result.shortMessage);
    });
  }

  hasContent(message?: ShortMessage): boolean {
    return !!message && (message.message?.trim() !== '' || message.multimedia?.type !== 'undefined');
  }

  isUnread(message: { direction: 'user' | 'contactUser'; readAt?: string | null }): boolean {
    return message.direction === 'contactUser' && !message.readAt;
  }

  editMessage(message: ChatroomMessage): void {
    const contact = this.contact();
    if (!contact || message.direction !== 'user') {
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
          console.log('Loaded contact messages', res);
          // Merge with already present (live/optimistic) messages so we do not drop them while loading
          const merged = new Map<string, ChatroomMessage>(
            this.messages().map((msg) => [msg.messageId, msg])
          );
          for (const msg of res.rows ?? []) {
            const payload = await this.contactMessageService.decryptAndVerify(contact, msg);
            const key = this.buildMessageKey(msg.id, msg.signature, msg.encryptedMessage);
            this.messageKeys.add(key);
            merged.set(msg.messageId, {
              id: msg.id,
              messageId: msg.messageId,
              direction: msg.direction,
              payload,
              createdAt: msg.createdAt,
              readAt: msg.readAt,
              status: msg.status,
              reaction: (msg as unknown as { reaction?: string | null }).reaction ?? null
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
    if (!contact || !this.userService.isReady()) {
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

  openReactionPicker(message: ChatroomMessage, event: MouseEvent): void {
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
      }
    };
  }

  private async sendAsNewMessage(contact: Contact, payload: ShortMessage): Promise<void> {
    const tempId = this.addOptimisticMessage(payload);
    const { encryptedMessageForUser, encryptedMessageForContact, signature } =
      await this.contactMessageService.encryptMessageForContact(contact, payload);

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
      error: () => {
        // optionally notify user
      }
    });
  }

  mapStatus(status?: string): string {
    return this.contactMessageService.mapStatusIcon(status as ('sent' | 'delivered' | 'read' | 'deleted' | undefined));
  }
}
