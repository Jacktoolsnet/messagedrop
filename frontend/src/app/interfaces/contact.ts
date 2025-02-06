import { Envelope } from "./envelope";

export interface Contact {
    id: string,
    userId: string,
    userMessage: string,
    userEncryptedMessage?: string,
    userMessageStyle: string,
    userSignature?: string,
    contactUserId: string,
    contactUserMessage: string,
    contactUserEncryptedMessage?: string,
    contactUserMessageStyle: string,
    contactUserSignature?: string,
    hint?: string,
    encryptionPublicKey?: JsonWebKey,
    signingPublicKey?: JsonWebKey,
    contactSignature?: ArrayBuffer,
    name?: string,
    base64Avatar?: string,
    subscribed: boolean,
    provided: boolean,
    lastMessageFrom: string,
    envelope?: Envelope
}
