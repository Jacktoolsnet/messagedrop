import { Message } from "./message";

export interface GetMessageResponse {
    status: number,
    rows: Message[]
}

