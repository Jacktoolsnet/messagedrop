import { Location } from "./location";
import { Multimedia } from "./multimedia";
import { ExperienceResult } from "./viator";

export interface ShortMessage {
    message: string,
    translatedMessage?: string,
    verified?: boolean,
    style: string,
    multimedia: Multimedia,
    location?: Location | null,
    experience?: ExperienceResult | null,
    experienceSearchTerm?: string | null,
    audio?: {
        base64: string,
        mimeType: string,
        sizeBytes: number,
        durationMs: number,
        waveform?: number[]
    } | null
}
