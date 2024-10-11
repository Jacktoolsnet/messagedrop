import { Contact } from "./contact";

export interface GetContactsResponse {
    status: number,
    rows: Contact[]
}

