import { ExperienceResult } from './viator';

export interface ExperienceBookmark {
  productCode: string;
  snapshot: ExperienceResult;
  lastUpdatedAt: number;
  sortOrder?: number;
}
