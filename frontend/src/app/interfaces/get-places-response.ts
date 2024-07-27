import { Place } from "./place";

export interface GetPlacesResponse {
    status: number,
    rows: Place[]
}

