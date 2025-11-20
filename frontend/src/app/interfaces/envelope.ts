
export interface Envelope {
    contactId: string,
    userId: string,
    contactUserId: string,
    messageSignature: string,
    userEncryptedMessage: string,
    contactUserEncryptedMessage: string,
    id?: string,
    messageId?: string
}
