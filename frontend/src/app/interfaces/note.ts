import { Multimedia } from "./multimedia";

export interface Note {
    id: string,
    latitude: number,
    longitude: number,
    plusCode: string,
    note: string,
    markerType: string,
    style: string,
    timestamp: number;
    multimedia: Multimedia
}

