import { NominatimPlace } from "./nominatim-place";

export interface GetNominatimAddressResponse {
    status: number,
    nominatimPlace: NominatimPlace
}

