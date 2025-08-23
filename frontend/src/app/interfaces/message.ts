import { Location } from "./location"
import { Multimedia } from "./multimedia"

export interface Message {
    id: number,
    uuid: string,
    parentId: number,
    parentUuid: string,
    typ: string,
    createDateTime: string,
    deleteDateTime: string,
    location: Location,
    message: string,
    translatedMessage?: string,
    markerType: string,
    style: string,
    views: number,
    likes: number,
    dislikes: number,
    comments: Message[],
    commentsNumber: number,
    status: string,
    userId: string
    multimedia: Multimedia
}

