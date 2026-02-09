import { ExperienceResult } from './viator';

export interface ExperienceBookmark {
  productCode: string;
  snapshot: ExperienceResult;
  hashtags?: string[];
  lastUpdatedAt: number;
  sortOrder?: number;
}
