export type DsaTextBlockType = 'reasoning_template' | 'legal_basis' | 'tos_clause';

export interface DsaTextBlock {
  id: string;
  key: string;
  type: DsaTextBlockType;
  labelDe: string;
  labelEn: string;
  descriptionDe: string;
  descriptionEn: string;
  contentDe: string;
  contentEn: string;
  sortOrder: number;
  isActive: boolean;
  translatedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface DsaTextBlockFilters {
  type?: DsaTextBlockType | '' | null;
  q?: string | null;
  activeOnly?: boolean;
}

export interface DsaTextBlockSavePayload {
  key?: string;
  type: DsaTextBlockType;
  labelDe: string;
  labelEn: string;
  descriptionDe: string;
  descriptionEn: string;
  contentDe: string;
  contentEn: string;
  sortOrder: number;
  isActive: boolean;
  translatedAt?: number | null;
}

export interface DsaTextBlockTranslationPreview {
  labelEn: string;
  descriptionEn: string;
  contentEn: string;
  translatedAt: number;
  usedFallback?: boolean;
}
