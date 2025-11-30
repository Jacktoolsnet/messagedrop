import { AirQualityCategory, AirQualityMetricKey } from '../interfaces/air-quality-tile-value';

export type AirQualitySeverity = 'none' | 'warn' | 'alert';

interface ThresholdConfig {
  thresholds: number[];
  labels: string[];
}

const configMap: Record<AirQualityCategory, ThresholdConfig> = {
  pollen: {
    thresholds: [0, 10, 30, 50],
    labels: ['None', 'Low', 'Moderate', 'High', 'Very High']
  },
  particulateMatter: {
    thresholds: [20, 40, 60, 100],
    labels: ['Good', 'Moderate', 'Unhealthy for Sensitive', 'Unhealthy', 'Very Unhealthy']
  },
  pollutants: {
    thresholds: [40, 100, 200],
    labels: ['Good', 'Moderate', 'Unhealthy', 'Very Unhealthy']
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
): { label: string; severity: AirQualitySeverity; color: string } {
  const category = getAirQualityCategoryForKey(key);
  const { thresholds, labels } = configMap[category];

  const idx = thresholds.findIndex((t) => value <= t);
  const levelIndex = idx === -1 ? thresholds.length : idx;
  const label = labels[levelIndex] ?? labels[labels.length - 1];

  const severity: AirQualitySeverity =
    levelIndex >= labels.length - 1 ? 'alert' :
    levelIndex >= labels.length - 2 ? 'warn' :
    'none';

  const palette = getPaletteForCategory(category);
  const baseColor = palette[levelIndex] ?? palette[palette.length - 1];
  const color = isDarkMode ? baseColor : adjustColor(baseColor, -40);

  return { label, severity, color };
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
