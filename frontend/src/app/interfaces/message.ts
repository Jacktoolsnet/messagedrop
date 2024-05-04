export interface Message {
    messageId?: number,
    parentMessageId?: number,
    messageTyp?: string,
    messageCreateDateTime?: string,
    messageDeleteDateTime?: string,
    latitude?: number,
    longitude?: number,
    plusCode?: string,
    message?: string,
    style?: string,
    views?: number,
    likes?: number,
    dislikes?: number,
    status?: string,
    userId?: string
}

