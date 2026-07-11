import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Contact } from '../interfaces/contact';
import { Location } from '../interfaces/location';
import { MultimediaType } from '../interfaces/multimedia-type';
import { ShortMessage } from '../interfaces/short-message';
import { ContactMessageService } from './contact-message.service';
import { SocketioService } from './socketio.service';

export interface ContactLocationShareResult {
  sent: number;
  failed: number;
}

@Injectable({ providedIn: 'root' })
export class ContactLocationShareService {
  private readonly contactMessageService = inject(ContactMessageService);
  private readonly socketioService = inject(SocketioService);

  async shareLocationWithContacts(location: Location, contacts: Contact[]): Promise<ContactLocationShareResult> {
    let sent = 0;
    let failed = 0;

    for (const contact of contacts) {
      try {
        await this.sendLocationMessage(contact, location);
        sent += 1;
      } catch (error) {
        console.error('Failed to share location with contact', contact.id, error);
        failed += 1;
      }
    }

    return { sent, failed };
  }

  private async sendLocationMessage(contact: Contact, location: Location): Promise<void> {
    if ((contact.status || 'active') !== 'active') {
      throw new Error('contact_inactive');
    }

    this.socketioService.initSocket();

    const payload = this.createLocationMessage(location);
    const { encryptedMessageForUser, encryptedMessageForContact, signature } =
      await this.contactMessageService.encryptMessageForContact(contact, payload);

    const response = await firstValueFrom(this.contactMessageService.send({
      contactId: contact.id,
      userId: contact.userId,
      contactUserId: contact.contactUserId,
      direction: 'user',
      encryptedMessageForUser,
      encryptedMessageForContact,
      signature
    }));

    await this.contactMessageService.storeLocalPayload(response.sharedMessageId, payload);
    this.socketioService.sendContactMessage({
      id: response.mirrorMessageId ?? response.messageId,
      messageId: response.sharedMessageId,
      contactId: contact.id,
      userId: contact.userId,
      contactUserId: contact.contactUserId,
      messageSignature: signature,
      userEncryptedMessage: encryptedMessageForUser,
      contactUserEncryptedMessage: encryptedMessageForContact
    });
  }

  private createLocationMessage(location: Location): ShortMessage {
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
      location: { ...location },
      audio: null
    };
  }
}
