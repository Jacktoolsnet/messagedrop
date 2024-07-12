import { MarkerType } from "./marker-type";

export interface MarkerLocation {
    latitude: number,
    longitude: number,
    plusCode: string,
    type: MarkerType
}
