import { CommonModule } from '@angular/common';
import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, ViewChild, computed, effect, inject, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { Contact } from '../../interfaces/contact';
import { ShortMessage } from '../../interfaces/short-message';
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
  private readonly dialogRef = inject(MatDialogRef<ContactMessageChatroomComponent>);
  private readonly contactId = inject<string>(MAT_DIALOG_DATA);

  @ViewChild('messageScroll') private messageScroll?: ElementRef<HTMLElement>;

  readonly contact = computed(() =>
    this.contactService.sortedContactsSignal().find(contact => contact.id === this.contactId)
  );
  readonly composeMessage = output<Contact>();

  private readonly scrollEffect = effect(() => {
    if (!this.contact()) {
      return;
    }
    queueMicrotask(() => this.scrollToBottom());
  });

  ngAfterViewInit(): void {
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

  private scrollToBottom(): void {
    const container = this.messageScroll?.nativeElement;
    if (!container) {
      return;
    }
    container.scrollTop = container.scrollHeight;
  }
}
