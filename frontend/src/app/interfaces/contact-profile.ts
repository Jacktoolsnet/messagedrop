import { AvatarAttribution } from './avatar-attribution';

export interface ContactProfile {
    name: string,
    base64Avatar: string
    avatarFileId?: string,
    avatarAttribution?: AvatarAttribution,
    chatBackgroundImage?: string,
    chatBackgroundFileId?: string,
    chatBackgroundTransparency?: number,
    defaultStyle?: string,
    pinned: boolean
}
