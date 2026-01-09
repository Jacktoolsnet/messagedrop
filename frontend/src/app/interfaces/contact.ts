import { AvatarAttribution } from './avatar-attribution';

export interface Contact {
    id: string,
    userId: string,
    // Legacy message fields retained as optional for compatibility; actual messages come from contactMessage service
    userSignature?: ArrayBuffer,
    userMessage?: unknown,
    userMessageVerified?: boolean,
    userEncryptedMessage?: unknown,
    contactUserId: string,
    contactSignature?: ArrayBuffer,
    contactUserMessage?: unknown,
    contactUserMessageVerified?: boolean,
    contactUserEncryptedMessage?: unknown,
    contactUserSignature?: ArrayBuffer,
    contactUserSigningPublicKey?: JsonWebKey,
    contactUserEncryptionPublicKey?: JsonWebKey,
    hint?: string,
    name?: string,
    base64Avatar?: string,
    avatarFileId?: string,
    avatarOriginalFileId?: string,
    avatarAttribution?: AvatarAttribution,
    chatBackgroundImage?: string,
    chatBackgroundFileId?: string,
    chatBackgroundOriginalFileId?: string,
    chatBackgroundAttribution?: AvatarAttribution,
    chatBackgroundTransparency?: number,
    subscribed: boolean,
    pinned: boolean,
    provided: boolean,
    lastMessageFrom: string,
    lastMessageAt?: string | null
    unreadCount?: number,
    tileSettings?: import('./tile-settings').TileSetting[]
}
