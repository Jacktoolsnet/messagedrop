import { Keypair } from "./keypair";
import { Location } from "./location";

export interface Contact {
    id: String,    
    connectId: String,
    userId: String,    
    encryptionPublicKey?: JsonWebKey,
    signingPublicKey?: JsonWebKey,
    signature?: ArrayBuffer,
    name?: String,
    base64Avatar?: String
}
