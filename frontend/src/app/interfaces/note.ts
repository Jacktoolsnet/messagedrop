import { Multimedia } from "./multimedia";

export interface Note {
    latitude: number,
    longitude: number,
    plusCode: string,
    note: string,
    markerType: string,
    style: string,
    multimedia: Multimedia
}

