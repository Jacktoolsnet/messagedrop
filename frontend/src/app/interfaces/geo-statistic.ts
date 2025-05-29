export interface GeoStatistic {
    coordinates: {
        latitude: number;
        longitude: number;
    };
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
        gdp: { year: string; value: number | null }[];
        gniPerCapita: { year: string; value: number | null }[];
        militaryExpenditure: { year: string; value: number | null }[];
        governmentSpending: { year: string; value: number | null }[];
        inflation: { year: string; value: number | null }[];
        unemployment: { year: string; value: number | null }[];
        investment: { year: string; value: number | null }[];
        lifeExpectancy: { year: string; value: number | null }[];
        povertyRate: { year: string; value: number | null }[];
        literacyRate: { year: string; value: number | null }[];
        primaryEnrollment: { year: string; value: number | null }[];
        secondaryEnrollment: { year: string; value: number | null }[];
        giniIndex: { year: string; value: number | null }[];
        co2Emissions: { year: string; value: number | null }[];
        renewableEnergy: { year: string; value: number | null }[];
        forestArea: { year: string; value: number | null }[];
        airPollution: { year: string; value: number | null }[];
        energyUse: { year: string; value: number | null }[];
        gdpPerCapita: { year: string; value: number | null }[];
    };
    weatherHistory: {
        latitude: number;
        longitude: number;
        elevation: number;
        timezone: string;
        temperatureTrend: { year: string; value: number }[];
        precipitationTrend: { year: string; value: number }[];
    };
}