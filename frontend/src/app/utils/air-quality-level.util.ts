import { AirQualityCategory, AirQualityMetricKey } from '../interfaces/air-quality-tile-value';

export type AirQualitySeverity = 'none' | 'warn' | 'alert';

interface ThresholdConfig {
  thresholds: number[];
  labelKeys: string[];
}

const configMap: Record<AirQualityCategory, ThresholdConfig> = {
  pollen: {
    thresholds: [0, 10, 30, 50],
    labelKeys: [
      'weather.airQuality.pollen.none',
      'weather.airQuality.pollen.low',
      'weather.airQuality.pollen.moderate',
      'weather.airQuality.pollen.high',
      'weather.airQuality.pollen.veryHigh'
    ]
  },
  particulateMatter: {
    thresholds: [20, 40, 60, 100],
    labelKeys: [
      'weather.airQuality.particulateMatter.good',
      'weather.airQuality.particulateMatter.moderate',
      'weather.airQuality.particulateMatter.unhealthySensitive',
      'weather.airQuality.particulateMatter.unhealthy',
      'weather.airQuality.particulateMatter.veryUnhealthy'
    ]
  },
  pollutants: {
    thresholds: [40, 100, 200],
    labelKeys: [
      'weather.airQuality.pollutants.good',
      'weather.airQuality.pollutants.moderate',
      'weather.airQuality.pollutants.unhealthy',
      'weather.airQuality.pollutants.veryUnhealthy'
    ]
  }
};

export function getAirQualityCategoryForKey(key: AirQualityMetricKey): AirQualityCategory {
  if (['alder_pollen', 'birch_pollen', 'grass_pollen', 'mugwort_pollen', 'olive_pollen', 'ragweed_pollen'].includes(key)) {
    return 'pollen';
  }
  if (['pm10', 'pm2_5'].includes(key)) {
    return 'particulateMatter';
  }
  return 'pollutants';
}

export function getAirQualityLevelInfo(
  key: AirQualityMetricKey,
  value: number,
  isDarkMode = false
): { labelKey: string; severity: AirQualitySeverity; color: string } {
  const category = getAirQualityCategoryForKey(key);
  const { thresholds, labelKeys } = configMap[category];

  const idx = thresholds.findIndex((t) => value <= t);
  const levelIndex = idx === -1 ? thresholds.length : idx;
  const labelKey = labelKeys[levelIndex] ?? labelKeys[labelKeys.length - 1];

  const severity: AirQualitySeverity =
    levelIndex >= labelKeys.length - 1 ? 'alert' :
    levelIndex >= labelKeys.length - 2 ? 'warn' :
    'none';

  const palette = getPaletteForCategory(category);
  const baseColor = palette[levelIndex] ?? palette[palette.length - 1];
  const color = isDarkMode ? baseColor : adjustColor(baseColor, -40);

  return { labelKey, severity, color };
}

function getPaletteForCategory(category: AirQualityCategory): string[] {
  const gray = '#BDBDBD';
  const green = '#4CAF50';
  const amber = '#FFC107';
  const orange = '#FB8C00';
  const red = '#E53935';
  const deepRed = '#B71C1C';

  switch (category) {
    case 'pollen':
      return [gray, green, amber, orange, red];
    case 'particulateMatter':
      return [green, amber, orange, red, deepRed];
    case 'pollutants':
      return [green, amber, red, deepRed];
    default:
      return [gray];
  }
}

function adjustColor(hex: string, amount: number): string {
  return '#' + hex.replace(/^#/, '').replace(/../g, c =>
    ('0' + Math.min(255, Math.max(0, parseInt(c, 16) + amount)).toString(16)).slice(-2)
  );
}
