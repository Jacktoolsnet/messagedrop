import { Keypair } from "./keypair";

export interface User {
    userId: string,
    encryptionKeyPair?: Keypair,
    signingKeyPair?: Keypair,
    userName?: string,
    base64Avatar?: string
}
