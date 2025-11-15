import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { Contact } from '../../interfaces/contact';
import { ShortMessage } from '../../interfaces/short-message';
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
export class ContactMessageChatroomComponent {
  private readonly userService = inject(UserService);
  private readonly socketioService = inject(SocketioService);
  private readonly dialogRef = inject(MatDialogRef<ContactMessageChatroomComponent>);
  readonly contact = inject<Contact>(MAT_DIALOG_DATA);

  readonly composeMessage = output<Contact>();

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
    this.composeMessage.emit(this.contact);
  }

  hasContent(message?: ShortMessage): boolean {
    return !!message && (message.message?.trim() !== '' || message.multimedia?.type !== 'undefined');
  }
}
