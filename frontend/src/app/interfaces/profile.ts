import { AvatarAttribution } from './avatar-attribution';

export interface Profile {
    name: string,
    base64Avatar: string
    avatarFileId?: string
    avatarOriginalFileId?: string
    avatarAttribution?: AvatarAttribution
    defaultStyle?: string
}
