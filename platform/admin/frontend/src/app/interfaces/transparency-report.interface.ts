export interface TransparencyReport {
  id: string;
  title: string;
  description?: string | null;
  format: string;
  generatedAt: number;
  sizeBytes?: number | null;
  period: {
    from: number | null;
    to: number;
    label: string;
  };
  rangeKey?: string;
}
