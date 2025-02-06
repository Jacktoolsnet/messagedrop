export interface Envelope {
    contactId: string,
    userId: string,
    contactUserId: string,
    messageSignature: string,
    encryptedMessage: string,
    messageStyle: string
}