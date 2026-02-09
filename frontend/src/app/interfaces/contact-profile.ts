import { AvatarAttribution } from './avatar-attribution';

export interface ContactProfile {
    name: string,
    hashtags?: string[],
    base64Avatar: string
    avatarFileId?: string,
    avatarOriginalFileId?: string,
    avatarAttribution?: AvatarAttribution,
    chatBackgroundImage?: string,
    chatBackgroundFileId?: string,
    chatBackgroundOriginalFileId?: string,
    chatBackgroundAttribution?: AvatarAttribution,
    chatBackgroundTransparency?: number,
    defaultStyle?: string,
    pinned: boolean,
    sortOrder?: number
}
