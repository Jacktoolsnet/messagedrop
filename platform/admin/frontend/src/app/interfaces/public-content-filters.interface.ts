import { PublicContentStatus } from './public-content-status.type';
import { PublicContentType } from './public-content-type.type';

export interface PublicContentFilters {
  publicProfileId?: string;
  contentType?: PublicContentType | 'all';
  status?: PublicContentStatus | 'all';
  q?: string;
  limit?: number;
  offset?: number;
}
