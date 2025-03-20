import { MultimediaType } from "./multimedia-type";

export interface Multimedia {
    type: MultimediaType,
    url: string,
    sourceUrl: string,
    attribution: string,
    title: string,
    description: string,
}