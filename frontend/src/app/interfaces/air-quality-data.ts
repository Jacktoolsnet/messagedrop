export interface AirQualityData {
  latitude: number;
  longitude: number;
  generationtime_ms: number;
  utc_offset_seconds: number;
  timezone: string;
  timezone_abbreviation: string;
  elevation: number;
  hourly_units: {
    time: string;
    alder_pollen: string;
    birch_pollen: string;
    grass_pollen: string;
    mugwort_pollen: string;
    olive_pollen: string;
    ragweed_pollen: string;
    pm10: string;
    pm2_5: string;
    carbon_monoxide: string;
    nitrogen_dioxide: string;
    sulphur_dioxide: string;
    ozone: string;
  };
  hourly: {
    time: string[];
    alder_pollen: number[];
    birch_pollen: number[];
    grass_pollen: number[];
    mugwort_pollen: number[];
    olive_pollen: number[];
    ragweed_pollen: number[];
    pm10: number[];
    pm2_5: number[];
    carbon_monoxide: number[];
    nitrogen_dioxide: number[];
    sulphur_dioxide: number[];
    ozone: number[];
  };
}