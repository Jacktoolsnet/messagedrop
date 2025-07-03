import { BoundingBox } from "./bounding-box"
import { Location } from "./location"

export interface Place {
    id: string,
    userId: string,
    location: Location,
    name: string,
    base64Avatar: string
    icon: string,
    subscribed: boolean,
    boundingBox: BoundingBox,
    timezone: string
}

