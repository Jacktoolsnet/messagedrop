import { MultimediaType } from "./multimedia-type";
import { Oembed } from "./oembed";
import { Location } from "./location";

export interface Multimedia {
    type: MultimediaType,
    mediaKind?: 'gif' | 'sticker' | 'clip' | 'meme',
    url: string,
    contentId: string,
    sourceUrl: string,
    attribution: string,
    title: string,
    description: string,
    location?: Location | null,
    oembed?: Oembed
}
