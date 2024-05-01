export interface Message {
    messageId: number,
    parentMessageId: number,
    messageTyp: string,
    messageCreateDateTime: string,
    messageDeleteDateTime: string,
    latitude: number,
    longitude: number,
    plusCode: string,
    message: string,
    messageViews: number,
    messageLikes: number,
    messageDislikes: number,
    messageStatus: string,
    messageUserId: string
}

