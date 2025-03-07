import { Keypair } from "./keypair";
import { Location } from "./location";

export interface User {
    id: string,
    location: Location,
    local: string,
    language: string,
    subscription: string,
    defaultStyle: string,
    symmetricalKey: JsonWebKey,
    encryptionKeyPair: Keypair,
    signingKeyPair: Keypair,
    name: string,
    base64Avatar: string
}
