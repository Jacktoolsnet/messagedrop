import { Envelope } from "./envelope";

export interface Contact {
    id: string,
    userId: string,
    userMessage: string,
    userMessageVerified: boolean,
    userEncryptedMessage?: string,
    userMessageStyle: string,
    userSignature?: ArrayBuffer,
    contactUserId: string,
    contactUserSigningPublicKey?: JsonWebKey,
    contactUserEncryptionPublicKey?: JsonWebKey,
    contactUserMessage: string,
    contactUserMessageVerified: boolean,
    contactUserEncryptedMessage?: string,
    contactUserMessageStyle: string,
    contactUserSignature?: ArrayBuffer,
    hint?: string,
    contactSignature?: ArrayBuffer,
    name?: string,
    base64Avatar?: string,
    subscribed: boolean,
    provided: boolean,
    lastMessageFrom: string,
    envelope?: Envelope
}
