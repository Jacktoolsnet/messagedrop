import { AirQualityCategory, AirQualityMetricKey } from '../interfaces/air-quality-tile-value';

export type AirQualitySeverity = 'none' | 'warn' | 'alert';

interface ThresholdConfig {
  thresholds: number[];
  labelKeys: string[];
}

const LEVEL_LABEL_KEYS = [
  'weather.airQuality.level.veryLow',
  'weather.airQuality.level.low',
  'weather.airQuality.level.medium',
  'weather.airQuality.level.elevated',
  'weather.airQuality.level.high',
  'weather.airQuality.level.veryHigh'
];

const POLLEN_LABEL_KEYS = [
  'weather.airQuality.pollen.none',
  'weather.airQuality.pollen.low',
  'weather.airQuality.pollen.medium',
  'weather.airQuality.pollen.high',
  'weather.airQuality.pollen.veryHigh'
];

const POLLEN_CONFIG: ThresholdConfig = {
  thresholds: [0, 10, 30, 50],
  labelKeys: POLLEN_LABEL_KEYS
};

const POLLUTANT_CONFIGS: Partial<Record<AirQualityMetricKey, ThresholdConfig>> = {
  pm2_5: {
    thresholds: [10, 20, 25, 50, 75],
    labelKeys: LEVEL_LABEL_KEYS
  },
  pm10: {
    thresholds: [20, 40, 50, 100, 150],
    labelKeys: LEVEL_LABEL_KEYS
  },
  nitrogen_dioxide: {
    thresholds: [40, 90, 120, 230, 340],
    labelKeys: LEVEL_LABEL_KEYS
  },
  ozone: {
    thresholds: [50, 100, 130, 240, 380],
    labelKeys: LEVEL_LABEL_KEYS
  },
  sulphur_dioxide: {
    thresholds: [100, 200, 350, 500, 750],
    labelKeys: LEVEL_LABEL_KEYS
  }
};

const UNCLASSIFIED_LABEL_KEY = 'weather.airQuality.level.measured';

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
): { labelKey: string; severity: AirQualitySeverity; color: string; levelIndex: number; classified: boolean } {
  const category = getAirQualityCategoryForKey(key);
  const config = category === 'pollen' ? POLLEN_CONFIG : POLLUTANT_CONFIGS[key];

  if (!config) {
    const neutralColor = isDarkMode ? '#90A4AE' : adjustColor('#90A4AE', -35);
    return {
      labelKey: UNCLASSIFIED_LABEL_KEY,
      severity: 'none',
      color: neutralColor,
      levelIndex: 0,
      classified: false
    };
  }

  const idx = config.thresholds.findIndex((threshold) => value <= threshold);
  const levelIndex = idx === -1 ? config.thresholds.length : idx;
  const labelKey = config.labelKeys[levelIndex] ?? config.labelKeys[config.labelKeys.length - 1];

  const severity: AirQualitySeverity =
    levelIndex >= config.labelKeys.length - 2 ? 'alert' :
    levelIndex >= config.labelKeys.length - 3 ? 'warn' :
    'none';

  const palette = getPaletteForCategory(category, config.labelKeys.length);
  const baseColor = palette[levelIndex] ?? palette[palette.length - 1];
  const color = isDarkMode ? baseColor : adjustColor(baseColor, -40);

  return { labelKey, severity, color, levelIndex, classified: true };
}

function getPaletteForCategory(category: AirQualityCategory, levelCount: number): string[] {
  const gray = '#BDBDBD';
  const green = '#4CAF50';
  const lightGreen = '#8BC34A';
  const amber = '#FFC107';
  const orange = '#FB8C00';
  const red = '#E53935';
  const deepRed = '#B71C1C';

  if (category === 'pollen') {
    return [gray, green, amber, orange, red];
  }

  const fullPalette = [green, lightGreen, amber, orange, red, deepRed];
  return fullPalette.slice(0, Math.max(1, levelCount));
}

function adjustColor(hex: string, amount: number): string {
  return '#' + hex.replace(/^#/, '').replace(/../g, c =>
    ('0' + Math.min(255, Math.max(0, parseInt(c, 16) + amount)).toString(16)).slice(-2)
  );
}
