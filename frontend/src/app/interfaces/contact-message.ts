export interface ContactMessage {
  id: string;
  contactId: string;
  direction: 'user' | 'contactUser';
  encryptedMessage: string;
  signature: string;
  status: 'sent' | 'delivered' | 'read';
  createdAt: string;
  readAt?: string | null;
}

export interface ContactMessageListResponse {
  status: number;
  rows: ContactMessage[];
}

export interface ContactMessageSendResponse {
  status: number;
  messageId: string;
}
