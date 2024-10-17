export interface Connect {
    id: string,
    userId: string,
    hint: string,
    encryptionPublicKey: string,
    signingPublicKey: string,
    signature: string
    timeOfCreation?: string
}

