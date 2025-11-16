export interface RawContact {
  id: string;
  userId: string;
  contactUserId: string;
  contactUserSigningPublicKey: string;
  contactUserEncryptionPublicKey: string;
  contactUserEncryptedMessage?: string;
  contactUserSignature?: string;
  userEncryptedMessage?: string;
  userSignature?: string;
  contactSignature?: string;
  name: string;
  base64Avatar: string;
  subscribed: boolean;
  provided: boolean;
  hint?: string;
  lastMessageFrom: string;
  lastMessageAt?: string | null;
}
