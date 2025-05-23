export interface HourlyWeather {
    time: string;                     // z. B. '2025-05-23T14:00'
    temperature: number;              // °C
    precipitationProbability: number; // %
    windspeed: number;               // km/h
    cloudcover: number;              // %
}
