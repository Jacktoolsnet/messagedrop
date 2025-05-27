export interface GeoStatistic {
    coordinates: { latitude: number; longitude: number; };
    nominatim: {
        country: string;
        state?: string;
        county?: string;
        city?: string;
        suburb?: string;
        neighbourhood?: string;
    };
    countryInfo: {
        name: string;
        officialName: string;
        capital: string;
        region: string;
        subregion: string;
        population: number;
        area_km2: number;
        populationDensity_per_km2: number;
        currencies: string[];
        languages: string[];
        flag_svg: string;
        googleMaps: string;
    };
    worldBank: {
        gdp: { year: string; value: number | null; };
        gdpPerCapita: number | null;
        gniPerCapita: { year: string; value: number | null; };
        lifeExpectancy: { year: string; value: number | null; };
        povertyRate: { year: string; value_percent: number | null; };
    };
    weatherHistory: {
        latitude: number;
        longitude: number;
        elevation: number;
        timezone: string;
        daily: {
            time: string[];
            temperature_2m_mean: number[];
            precipitation_sum: number[];
        };
    };
}