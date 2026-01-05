export interface ContactProfile {
    name: string,
    base64Avatar: string
    chatBackgroundImage?: string,
    chatBackgroundTransparency?: number,
    defaultStyle?: string,
    pinned: boolean
}
