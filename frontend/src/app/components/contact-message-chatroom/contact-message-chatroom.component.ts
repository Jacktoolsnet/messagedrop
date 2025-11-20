import { CommonModule } from '@angular/common';
import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, QueryList, ViewChild, ViewChildren, computed, effect, inject, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { Contact } from '../../interfaces/contact';
import { ShortMessage } from '../../interfaces/short-message';
import { Mode } from '../../interfaces/mode';
import { MultimediaType } from '../../interfaces/multimedia-type';
import { ContactMessageService } from '../../services/contact-message.service';
import { ContactService } from '../../services/contact.service';
import { SocketioService } from '../../services/socketio.service';
import { UserService } from '../../services/user.service';
import { ShowmultimediaComponent } from '../multimedia/showmultimedia/showmultimedia.component';
import { ShowmessageComponent } from '../showmessage/showmessage.component';
import { ContactEditMessageComponent } from '../contact/contact-edit-message/contact-edit-message.component';

type ChatroomMessage = {
  id: string;
  messageId: string;
  direction: 'user' | 'contactUser';
  payload: ShortMessage | null;
  createdAt: string;
  readAt?: string | null;
  status?: string;
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

  private readonly scrollEffect = effect(() => {
    void this.messages();
    queueMicrotask(() => this.scrollToBottom());
  });

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
      this.messages.update(msgs => [...msgs, {
        id: incoming.id,
        messageId: incoming.messageId,
        direction: incoming.direction,
        payload,
        createdAt: incoming.createdAt,
        readAt: incoming.readAt,
        status: incoming.status
      }]);
      queueMicrotask(() => this.scrollToBottom());
    }
    this.contactMessageService.liveMessages.set(null);
  }, { allowSignalWrites: true });

  private readonly loadMessagesEffect = effect(() => {
    const contact = this.contact();
    if (contact && !this.loaded()) {
      this.loadMessages();
    }
  }, { allowSignalWrites: true });

  private readonly updatedMessagesEffect = effect(async () => {
    const updated = this.contactMessageService.updatedMessages();
    const contact = this.contact();
    if (!updated || !contact || updated.contactId !== contact.id) {
      return;
    }
    const payload = await this.contactMessageService.decryptAndVerify(contact, updated);
    this.messages.update((msgs) =>
      msgs.map((msg) =>
        msg.messageId === updated.messageId ? { ...msg, payload, status: updated.status } : msg
      )
    );
    this.contactMessageService.updatedMessages.set(null);
  }, { allowSignalWrites: true });

  ngAfterViewInit(): void {
    this.contactMessageService.initLiveReceive();
    queueMicrotask(() => this.scrollToBottom());
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
    if (currentContact) {
      this.composeMessage.emit(currentContact);
    }
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
      void this.persistEditedMessage(contact, message, result.shortMessage);
    });
  }

  deleteMessage(_message: ChatroomMessage): void {
    console.warn('Delete message not yet implemented');
  }

  addOptimisticMessage(message: ShortMessage): void {
    const contact = this.contact();
    if (!contact) {
      return;
    }
    const now = new Date().toISOString();
    const messageId = crypto.randomUUID();
    this.messages.update((msgs) => [...msgs, {
      id: `local-${messageId}`,
      messageId,
      direction: 'user',
      payload: message,
      createdAt: now,
      status: 'sent'
    }]);
    queueMicrotask(() => this.scrollToBottom());
  }

  private loadMessages(): void {
    const contact = this.contact();
    if (!contact || this.loaded()) return;
    this.loading.set(true);
    this.contactMessageService.list(contact.id, { limit: 200 })
      .subscribe({
        next: async (res) => {
          const decrypted: ChatroomMessage[] = [];
          for (const msg of res.rows ?? []) {
            const payload = await this.contactMessageService.decryptAndVerify(contact, msg);
            const key = this.buildMessageKey(msg.id, msg.signature, msg.encryptedMessage);
            if (this.messageKeys.has(key)) {
              continue;
            }
            this.messageKeys.add(key);
            decrypted.push({
              id: msg.id,
              messageId: msg.messageId,
              direction: msg.direction,
              payload,
              createdAt: msg.createdAt,
              readAt: msg.readAt,
              status: msg.status
            });
          }
          decrypted.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
          this.messages.set(decrypted);
          this.loading.set(false);
          this.loaded.set(true);
          queueMicrotask(() => this.scrollToFirstUnread());
          // mark as read on open
          this.contactMessageService.markAllRead(contact.id).subscribe();
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
    const target = rows.find((row, index) => {
      const message = this.messages()[index];
      return message && this.isUnread(message);
    });
    if (target?.nativeElement) {
      target.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      this.scrolledToFirstUnread = true;
      return;
    }
    // No unread found; keep old behavior
    this.scrollToBottom();
    this.scrolledToFirstUnread = true;
  }

  private scrollToBottom(): void {
    const container = this.messageScroll?.nativeElement;
    if (!container) {
      return;
    }
    container.scrollTop = container.scrollHeight;
  }

  private buildMessageKey(id: string, signature: string, cipher: string): string {
    return `${id}|${signature}|${cipher}`;
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

  private async persistEditedMessage(contact: Contact, message: ChatroomMessage, updatedPayload: ShortMessage): Promise<void> {
    const { encryptedMessageForUser, encryptedMessageForContact, signature } =
      await this.contactMessageService.encryptMessageForContact(contact, updatedPayload);

    this.contactMessageService.updateMessage({
      messageId: message.messageId,
      contactId: contact.id,
      encryptedMessageForUser,
      encryptedMessageForContact,
      signature,
      userId: contact.userId,
      contactUserId: contact.contactUserId
    }).subscribe({
      next: () => {
        this.messages.update((msgs) =>
          msgs.map((msg) =>
            msg.messageId === message.messageId ? { ...msg, payload: updatedPayload } : msg
          )
        );
        this.socketioService.sendUpdatedContactMessage({
          id: message.id,
          messageId: message.messageId,
          contactId: contact.id,
          userId: contact.userId,
          contactUserId: contact.contactUserId,
          messageSignature: signature,
          userEncryptedMessage: encryptedMessageForUser,
          contactUserEncryptedMessage: encryptedMessageForContact
        });
      },
      error: () => {
        // optionally notify
      }
    });
  }
}
