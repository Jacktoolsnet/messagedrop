import { AirQualityData } from "./air-quality-data"
import { BoundingBox } from "./bounding-box"
import { Dataset } from "./dataset"
import { Location } from "./location"
import { Weather } from "./weather"
import { TileSetting } from "./tile-settings"

export interface Place {
    id: string,
    userId: string,
    location: Location,
    name: string,
    base64Avatar: string
    placeBackgroundImage?: string,
    placeBackgroundTransparency?: number,
    icon: string,
    subscribed: boolean,
    pinned: boolean,
    boundingBox: BoundingBox,
    timezone: string,
    tileSettings?: TileSetting[],
    datasets: {
        weatherDataset: Dataset<Weather>;
        airQualityDataset: Dataset<AirQualityData>;
    }
}
