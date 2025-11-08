export type WeatherTileType =
  | 'temperature'
  | 'precipitationprobability'
  | 'precipitation'
  | 'uvIndex'
  | 'wind'
  | 'pressure';

export interface WeatherTile {
  type: WeatherTileType;
  label: string;
  icon: string;
  value: string;
  levelText: string;
  minMax: { min: number; max: number };
}
