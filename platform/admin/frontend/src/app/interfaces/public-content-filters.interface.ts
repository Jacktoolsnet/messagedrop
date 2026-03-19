import { PublicContentStatus } from './public-content-status.type';

export interface PublicContentFilters {
  publicProfileId?: string;
  status?: PublicContentStatus | 'all';
  q?: string;
  limit?: number;
  offset?: number;
}
