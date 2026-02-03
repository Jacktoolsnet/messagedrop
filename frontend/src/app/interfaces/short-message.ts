import { Location } from "./location";
import { Multimedia } from "./multimedia";

export interface ShortMessage {
    message: string,
    translatedMessage?: string,
    verified?: boolean,
    style: string,
    multimedia: Multimedia,
    location?: Location | null
}
