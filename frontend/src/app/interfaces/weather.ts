import { DailyWeather } from "./daily-weather";
import { HourlyWeather } from "./hourly-weather";

export interface Weather {
    current: {
        temperature: number;
        windspeed: number;
        weatherCode: number;
        time: string;
    };
    hourly: HourlyWeather[];
    daily: DailyWeather[];
    address: {
        house_number?: string;
        road?: string;
        city?: string;
        town?: string;
        village?: string;
        hamlet?: string;
        county?: string;
        state?: string;
        postcode?: string;
        country?: string;
        country_code?: string;
    };
}
