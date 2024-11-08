import { Place } from "./place";

export interface GetPlacesResponse {
    status: number,
    rows: {
        id: string,
        userId: string,
        name: string,
        subscribed: boolean,
        plusCodes: string
    }[]
}

