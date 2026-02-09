import { Location } from "./location"
import { Multimedia } from "./multimedia"

export interface Message {
    id: number,
    uuid: string,
    parentId: number,
    parentUuid: string,
    typ: string,
    createDateTime: number | null,
    deleteDateTime: number | null,
    location: Location,
    message: string,
    translatedMessage?: string,
    markerType: string,
    style: string,
    hashtags?: string[],
    views: number,
    likes: number,
    dislikes: number,
    comments: Message[],
    commentsNumber: number,
    status: string,
    aiModerationDecision?: string | null,
    aiModerationScore?: number | null,
    aiModerationFlagged?: boolean | null,
    aiModerationAt?: number | null,
    patternMatch?: boolean | null,
    patternMatchAt?: number | null,
    manualModerationDecision?: string | null,
    manualModerationReason?: string | null,
    manualModerationAt?: number | null,
    manualModerationBy?: string | null,
    dsaStatusToken?: string,
    userId: string
    multimedia: Multimedia
}
