import { Keypair } from "./keypair";
import { Location } from "./location";
import { UserType } from "./user-type copy";

export interface User {
    id: string,
    pinHash: string,
    location: Location,
    local: string,
    language: string,
    subscription: string,
    defaultStyle: string,
    serverCryptoPublicKey: string,
    serverSigningPublicKey: string,
    cryptoKeyPair: Keypair,
    signingKeyPair: Keypair,
    name: string,
    base64Avatar: string,
    type: UserType,
}
