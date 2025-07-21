import { AirQualityData } from "./air-quality-data"
import { BoundingBox } from "./bounding-box"
import { Dataset } from "./dataset"
import { Location } from "./location"
import { Weather } from "./weather"

export interface Place {
    id: string,
    userId: string,
    location: Location,
    name: string,
    base64Avatar: string
    icon: string,
    subscribed: boolean,
    pinned: boolean,
    boundingBox: BoundingBox,
    timezone: string,
    datasets: {
        weatherDataset: Dataset<Weather>;
        airQualityDataset: Dataset<AirQualityData>;
    }
}

