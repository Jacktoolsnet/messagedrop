import { SeriesPoint } from './statistic-series-point.interface';

export interface SeriesResponse {
  status: number;
  key: string;
  from: string;
  to: string;
  points: SeriesPoint[];
  total: number;
  max: number;
}

