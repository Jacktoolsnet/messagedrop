import { PinEncryptedPayload } from './pin-encrypted-payload';

export interface CryptedUser {
  id: string;
  cryptedUser: PinEncryptedPayload;
}
