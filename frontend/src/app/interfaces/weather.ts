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
}
