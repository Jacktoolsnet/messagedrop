import { RawMessage } from "./raw-message";

export interface GetMessageResponse {
    status: number,
    rows: RawMessage[]
}

