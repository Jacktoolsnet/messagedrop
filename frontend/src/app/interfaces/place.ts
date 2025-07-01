import { BoundingBox } from "./bounding-box"

export interface Place {
    id: string,
    userId: string,
    name: string,
    base64Avatar: string
    icon: string,
    subscribed: boolean,
    boundingBox: BoundingBox | undefined,
    timezone: string
}

