export interface ContactMessage {
  id: string;
  messageId: string;
  contactId: string;
  direction: 'user' | 'contactUser';
  message: string;
  signature: string;
  translatedMessage?: string | null;
  status: 'sent' | 'delivered' | 'read' | 'deleted';
  createdAt: string;
  readAt?: string | null;
  reaction?: string | null;
}

export interface ContactMessageListResponse {
  status: number;
  rows: ContactMessage[];
}

export interface ContactMessageSendResponse {
  status: number;
  messageId: string;
  mirrorMessageId?: string;
  sharedMessageId: string;
}
