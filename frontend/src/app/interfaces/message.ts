export interface Message {
    id: number,
    parentId: number,
    typ: string,
    createDateTime: string,
    deleteDateTime: string,
    latitude: number,
    longitude: number,
    plusCode: string,
    message: string,
    markerType: string,
    style: string,
    views: number,
    likes: number,
    dislikes: number,
    status: string,
    userId: string,
    likedByUser?: boolean,
    dislikedByUser?: boolean
}

