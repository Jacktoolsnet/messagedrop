export interface Connect {
    id: string,
    userId: string,
    encryptionPublicKey: string,
    signingPublicKey: string,
    signature: string
    timeOfCreation?: string
}

