import { Keypair } from "./keypair";
import { Location } from "./location";

export interface User {
    id: string,
    encryptionKeyPair?: Keypair,
    signingKeyPair?: Keypair,
    name: string,
    base64Avatar?: string,
    location: Location
}
