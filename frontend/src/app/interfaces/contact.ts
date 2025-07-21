import { CryptoData } from "./crypto-data";
import { Envelope } from "./envelope";
import { ShortMessage } from "./short-message";

export interface Contact {
    id: string,
    userId: string,
    userSignature?: ArrayBuffer,
    userMessage: ShortMessage,
    userMessageVerified: boolean,
    userEncryptedMessage?: CryptoData,
    contactUserId: string,
    contactSignature?: ArrayBuffer,
    contactUserMessage: ShortMessage,
    contactUserMessageVerified: boolean,
    contactUserEncryptedMessage?: CryptoData,
    contactUserSignature?: ArrayBuffer,
    contactUserSigningPublicKey?: JsonWebKey,
    contactUserEncryptionPublicKey?: JsonWebKey,
    hint?: string,
    name?: string,
    base64Avatar?: string,
    subscribed: boolean,
    pinned: boolean,
    provided: boolean,
    lastMessageFrom: string,
    envelope?: Envelope
}
