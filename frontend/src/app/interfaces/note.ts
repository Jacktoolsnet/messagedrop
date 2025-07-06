import { Location } from "./location";
import { Multimedia } from "./multimedia";

export interface Note {
    id: string,
    location: Location,
    note: string,
    markerType: string,
    style: string,
    timestamp: number;
    multimedia: Multimedia
}

