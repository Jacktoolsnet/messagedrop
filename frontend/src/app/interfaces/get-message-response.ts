import { MessageRow } from './message-row';

export interface GetMessageResponse<T extends MessageRow = MessageRow> {
    status: number,
    rows: T[]
}
