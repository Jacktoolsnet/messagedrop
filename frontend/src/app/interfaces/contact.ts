import { Keypair } from "./keypair";
import { Location } from "./location";

export interface Contact {
    id: string,
    userId: string,    
    userMessage?: string,
    contactUserId: string,
    contactUserMessage?: string,
    hint?: string,
    encryptionPublicKey?: JsonWebKey,
    signingPublicKey?: JsonWebKey,
    signature?: ArrayBuffer,
    name?: string,
    base64Avatar?: string,
    subscribed: boolean,
    provided: boolean
}
