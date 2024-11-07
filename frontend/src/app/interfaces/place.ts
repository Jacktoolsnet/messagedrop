import { PlacePlusCode } from "./place-plus-code";

export interface Place {
    id: number,
    userId: string,
    name: string,
    subscribed: boolean,
    plusCodes: string[]
}

