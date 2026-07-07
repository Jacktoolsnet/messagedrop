import { SeriesPoint } from './statistic-series-point.interface';

export interface MultiSeriesResponse {
  status: number;
  from: string;
  to: string;
  series: Record<string, { points?: SeriesPoint[]; total?: number; max?: number; error?: string }>;
  summary?: {
    users?: number;
    visibleMessages?: number;
    visibleSecretDrops?: number;
    error?: string;
  };
}

