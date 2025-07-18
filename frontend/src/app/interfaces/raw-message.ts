export interface RawMessage {
    id: number,
    uuid: string,
    parentId: number,
    parentUuid: string,
    typ: string,
    createDateTime: string,
    deleteDateTime: string,
    latitude: number,
    longitude: number,
    plusCode: string,
    message: string,
    translatedMessage?: string,
    markerType: string,
    style: string,
    views: number,
    likes: number,
    dislikes: number,
    commentsNumber: number,
    status: string,
    userId: string,
    likedByUser?: boolean,
    dislikedByUser?: boolean
    multimedia: string
}

