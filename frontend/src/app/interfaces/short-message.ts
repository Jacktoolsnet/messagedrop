import { Multimedia } from "./multimedia";

export interface ShortMessage {
    message: string,
    translatedMessage?: string,
    style: string,
    multimedia: Multimedia
}

