export interface Pollen {
    latitude: number;
    longitude: number;
    generationtime_ms: number;
    utc_offset_seconds: number;
    timezone: string;
    timezone_abbreviation: string;
    elevation: number;
    daily_units: {
        time: string;
        grass_pollen: string;
        tree_pollen: string;
        weed_pollen: string;
        alder_pollen: string;
        birch_pollen: string;
        olive_pollen: string;
        ragweed_pollen: string;
    };
    daily: {
        time: string[];
        grass_pollen: number[];
        tree_pollen: number[];
        weed_pollen: number[];
        alder_pollen: number[];
        birch_pollen: number[];
        olive_pollen: number[];
        ragweed_pollen: number[];
    };
}