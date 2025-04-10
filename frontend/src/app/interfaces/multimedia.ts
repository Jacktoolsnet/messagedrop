import { MultimediaType } from "./multimedia-type";
import { Oembed } from "./oembed";

export interface Multimedia {
    type: MultimediaType,
    url: string,
    contentId: string,
    sourceUrl: string,
    attribution: string,
    title: string,
    description: string,
    oembed?: Oembed
}