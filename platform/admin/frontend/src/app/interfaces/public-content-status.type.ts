export type PublicContentStatus = 'draft' | 'published' | 'withdrawn' | 'deleted';

export const PUBLIC_CONTENT_STATUSES: readonly PublicContentStatus[] = [
  'draft',
  'published',
  'withdrawn',
  'deleted'
] as const;
