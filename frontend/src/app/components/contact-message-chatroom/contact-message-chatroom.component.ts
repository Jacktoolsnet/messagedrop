import { CommonModule } from '@angular/common';
import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, ViewChild, ViewChildren, QueryList, computed, effect, inject, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { Contact } from '../../interfaces/contact';
import { ShortMessage } from '../../interfaces/short-message';
import { ContactMessageService } from '../../services/contact-message.service';
import { ContactService } from '../../services/contact.service';
import { SocketioService } from '../../services/socketio.service';
import { UserService } from '../../services/user.service';
import { ShowmultimediaComponent } from '../multimedia/showmultimedia/showmultimedia.component';
import { ShowmessageComponent } from '../showmessage/showmessage.component';

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
  private readonly dialogRef = inject(MatDialogRef<ContactMessageChatroomComponent>);
  private readonly contactId = inject<string>(MAT_DIALOG_DATA);

  @ViewChild('messageScroll') private messageScroll?: ElementRef<HTMLElement>;
  @ViewChildren('messageRow') private messageRows?: QueryList<ElementRef<HTMLElement>>;

  readonly contact = computed(() =>
    this.contactService.sortedContactsSignal().find(contact => contact.id === this.contactId)
  );
  readonly composeMessage = output<Contact>();
  readonly messages = signal<{ id: string; direction: 'user' | 'contactUser'; payload: ShortMessage | null; createdAt: string; readAt?: string | null; status?: string }[]>([]);
  readonly loading = signal<boolean>(false);
  readonly loaded = signal<boolean>(false);
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
    const payload = await this.contactMessageService.decryptAndVerify(contact, incoming);
    this.messages.update(msgs => [...msgs, {
      id: incoming.id,
      direction: incoming.direction,
      payload,
      createdAt: incoming.createdAt,
      readAt: incoming.readAt,
      status: incoming.status
    }]);
    queueMicrotask(() => this.scrollToBottom());
    this.contactMessageService.liveMessages.set(null);
  }, { allowSignalWrites: true });

  private readonly loadMessagesEffect = effect(() => {
    const contact = this.contact();
    if (contact && !this.loaded()) {
      this.loadMessages();
    }
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

  addOptimisticMessage(message: ShortMessage): void {
    const contact = this.contact();
    if (!contact) {
      return;
    }
    const now = new Date().toISOString();
    this.messages.update((msgs) => [...msgs, {
      id: `local-${crypto.randomUUID()}`,
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
          const decrypted: { id: string; direction: 'user' | 'contactUser'; payload: ShortMessage | null; createdAt: string; readAt?: string | null; status?: string }[] = [];
          for (const msg of res.rows ?? []) {
            const payload = await this.contactMessageService.decryptAndVerify(contact, msg);
            decrypted.push({
              id: msg.id,
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
}
