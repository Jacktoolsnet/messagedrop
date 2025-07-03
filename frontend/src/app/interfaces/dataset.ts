import { DateTime } from "luxon";

export interface Dataset<T> {
    data: T | undefined;
    lastUpdate: DateTime | undefined;
}
