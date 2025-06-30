import { Keypair } from "./keypair";
import { Location } from "./location";
import { UserType } from "./user-type";

export interface User {
    id: string,
    pinHash: string,
    jwt?: string,
    jwtExpiresAt?: number,
    location: Location,
    locale: string,
    language: string,
    subscription: string,
    serverCryptoPublicKey: string,
    serverSigningPublicKey: string,
    cryptoKeyPair: Keypair,
    signingKeyPair: Keypair,
    type: UserType,
}
