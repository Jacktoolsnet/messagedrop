import { Envelope } from "./envelope";

export interface RawContact {
    id: string,
    userId: string,
    userMessage: string,
    userEncryptedMessage: string,
    userMessageStyle: string,
    userSignature: string,
    contactUserId: string,
    contactUserMessage: string,
    contactUserEncryptedMessage: string,
    contactUserMessageStyle: string,
    contactUserSignature: string,
    hint?: string,
    contactUserSigningPublicKey: string,
    contactUserEncryptionPublicKey: string,
    contactSignature: string,
    name: string,
    base64Avatar: string,
    subscribed: boolean,
    provided: boolean,
    lastMessageFrom: string,
    envelope: Envelope
}
