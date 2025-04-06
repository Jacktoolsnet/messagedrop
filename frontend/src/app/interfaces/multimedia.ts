import { MultimediaType } from "./multimedia-type";

export interface Multimedia {
    type: MultimediaType,
    url: string,
    contentId: string,
    sourceUrl: string,
    attribution: string,
    title: string,
    description: string,
}