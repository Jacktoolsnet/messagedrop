import { Location } from "./location";
import { Multimedia } from "./multimedia";
import { ExperienceResult } from "./viator";
import { ChatGame } from "./chat-game";

export interface ShortMessage {
    message: string,
    revisionOfMessageId?: string | null,
    translatedMessage?: string,
    verified?: boolean,
    style: string,
    multimedia: Multimedia,
    location?: Location | null,
    experience?: ExperienceResult | null,
    experienceSearchTerm?: string | null,
    game?: ChatGame | null,
    audio?: {
        base64: string,
        mimeType: string,
        sizeBytes: number,
        durationMs: number,
        waveform?: number[]
    } | null
}
