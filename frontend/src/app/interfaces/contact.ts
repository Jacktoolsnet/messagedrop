import { CryptoData } from "./crypto-data";
import { Envelope } from "./envelope";

export interface Contact {
    id: string,
    userId: string,
    userSignature?: ArrayBuffer,
    userMessage: string,
    userMessageVerified: boolean,
    userEncryptedMessage?: CryptoData,
    userMessageStyle: string,
    contactUserId: string,
    contactSignature?: ArrayBuffer,
    contactUserMessage: string,
    contactUserMessageVerified: boolean,
    contactUserEncryptedMessage?: CryptoData,
    contactUserMessageStyle: string,
    contactUserSignature?: ArrayBuffer,
    contactUserSigningPublicKey?: JsonWebKey,
    contactUserEncryptionPublicKey?: JsonWebKey,
    hint?: string,
    name?: string,
    base64Avatar?: string,
    subscribed: boolean,
    provided: boolean,
    lastMessageFrom: string,
    envelope?: Envelope
}
