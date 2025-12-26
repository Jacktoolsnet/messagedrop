import { WeatherTileType } from '../components/weather/weather-tile.interface';

export interface WeatherLevelInfo {
  labelKey: string;
  color: string;
}

export function getWeatherBaseColor(type: WeatherTileType, value: number): string {
  switch (type) {
    case 'temperature':
      if (value < 0) return '#1565C0';
      if (value < 10) return '#42A5F5';
      if (value < 20) return '#66BB6A';
      if (value < 28) return '#FFA726';
      if (value < 35) return '#EF5350';
      return '#B71C1C';
    case 'uvIndex':
      if (value < 3) return '#4CAF50';
      if (value < 6) return '#FFEB3B';
      if (value < 8) return '#FF9800';
      if (value < 11) return '#F44336';
      return '#9C27B0';
    case 'precipitationprobability':
      if (value < 20) return '#e0f7fa';
      if (value < 50) return '#81d4fa';
      if (value < 80) return '#0288d1';
      return '#01579b';
    case 'precipitation':
      if (value < 0.1) return '#e0f7fa';
      if (value < 1.0) return '#b3e5fc';
      if (value < 5.0) return '#81d4fa';
      if (value < 10.0) return '#4fc3f7';
      return '#0288d1';
    case 'wind':
      if (value < 5) return '#c8e6c9';
      if (value < 15) return '#aed581';
      if (value < 30) return '#fbc02d';
      if (value < 50) return '#fb8c00';
      return '#e64a19';
    case 'pressure':
      if (value < 980) return '#81d4fa';
      if (value < 1010) return '#c8e6c9';
      if (value < 1030) return '#ffcc80';
      return '#ffb74d';
    default:
      return '#ffffff';
  }
}

export function getWeatherLevelInfo(type: WeatherTileType, value: number, isDarkMode = false): WeatherLevelInfo {
  const baseColor = getWeatherBaseColor(type, value);
  const labelKey = getWeatherLevelLabel(type, value);
  const color = isDarkMode ? baseColor : adjustColor(baseColor, -50);
  return { labelKey, color };
}

export function getWeatherLevelLabel(type: WeatherTileType, value: number): string {
  switch (type) {
    case 'temperature':
      if (value < 0) return 'weather.level.temperature.freezing';
      if (value < 10) return 'weather.level.temperature.cold';
      if (value < 20) return 'weather.level.temperature.cool';
      if (value < 28) return 'weather.level.temperature.warm';
      if (value < 35) return 'weather.level.temperature.hot';
      return 'weather.level.temperature.extremeHeat';
    case 'uvIndex':
      if (value < 3) return 'weather.level.uvIndex.low';
      if (value < 6) return 'weather.level.uvIndex.moderate';
      if (value < 8) return 'weather.level.uvIndex.high';
      if (value < 11) return 'weather.level.uvIndex.veryHigh';
      return 'weather.level.uvIndex.extreme';
    case 'precipitationprobability':
      if (value < 20) return 'weather.level.precipitationProbability.unlikely';
      if (value < 50) return 'weather.level.precipitationProbability.possible';
      if (value < 80) return 'weather.level.precipitationProbability.likely';
      return 'weather.level.precipitationProbability.veryLikely';
    case 'precipitation':
      if (value < 0.1) return 'weather.level.precipitation.dry';
      if (value < 1.0) return 'weather.level.precipitation.lightRain';
      if (value < 5.0) return 'weather.level.precipitation.rain';
      if (value < 10.0) return 'weather.level.precipitation.heavyRain';
      return 'weather.level.precipitation.downpour';
    case 'wind':
      if (value < 5) return 'weather.level.wind.calm';
      if (value < 15) return 'weather.level.wind.breezy';
      if (value < 30) return 'weather.level.wind.windy';
      if (value < 50) return 'weather.level.wind.strongWind';
      return 'weather.level.wind.storm';
    case 'pressure':
      if (value < 980) return 'weather.level.pressure.low';
      if (value < 1010) return 'weather.level.pressure.moderate';
      if (value < 1030) return 'weather.level.pressure.high';
      return 'weather.level.pressure.veryHigh';
    default:
      return '';
  }
}

function adjustColor(hex: string, amount: number): string {
  return '#' + hex.replace(/^#/, '').replace(/../g, c =>
    ('0' + Math.min(255, Math.max(0, parseInt(c, 16) + amount)).toString(16)).slice(-2)
  );
}
