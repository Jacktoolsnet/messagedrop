import { Envelope } from "./envelope";

export interface Contact {
    id: string,
    userId: string,
    userMessage: string,
    userMessageStyle: string,
    contactUserId: string,
    contactUserMessage: string,
    contactUserMessageStyle: string,
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
