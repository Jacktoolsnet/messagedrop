import { Keypair } from "./keypair";
import { Location } from "./location";

export interface User {
    id: string,
    location: Location,
    encryptionKeyPair?: Keypair,
    signingKeyPair?: Keypair,
    name?: string,
    base64Avatar?: string
}
