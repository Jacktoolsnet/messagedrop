export interface ContactProfile {
    name: string,
    base64Avatar: string
    avatarFileId?: string,
    chatBackgroundImage?: string,
    chatBackgroundFileId?: string,
    chatBackgroundTransparency?: number,
    defaultStyle?: string,
    pinned: boolean
}
