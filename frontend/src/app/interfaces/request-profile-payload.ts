export interface RequestProfilePayload {
    id: string,
    userSignature?: ArrayBuffer,
    contactSignature?: ArrayBuffer,
    hint?: string,
    name?: string,
    base64Avatar?: string,
}