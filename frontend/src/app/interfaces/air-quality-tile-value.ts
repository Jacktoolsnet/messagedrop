import { AirQualityData } from './air-quality-data';

export type AirQualityCategory = 'pollen' | 'particulateMatter' | 'pollutants';
export type AirQualityMetricKey = Exclude<keyof AirQualityData['hourly'], 'time'>;

export interface AirQualityTileValue {
  key: AirQualityMetricKey;
  value: number;
  values: number[];
  time: string[];
  label: string;
  unit: string;
  color: string;
  icon: string;
  description: string;
  levelText: string;
  minMax: { min: number; max: number };
}
