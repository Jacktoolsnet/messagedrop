import { Keypair } from "./keypair";
import { Location } from "./location";

export interface User {
    id: string,
    location: Location,
    local: string,
    language: string,
    subscribed: boolean,
    encryptionKeyPair?: Keypair,
    signingKeyPair?: Keypair,
    name?: string,
    base64Avatar?: string
}
