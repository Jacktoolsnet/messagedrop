import { RawContact } from "./raw-contact";

export interface GetContactsResponse {
    status: number,
    rows: RawContact[]
}

