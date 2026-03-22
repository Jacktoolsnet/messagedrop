export interface AiModel {
  id: string;
  createdAt: number | null;
  ownedBy: string;
  available: boolean;
  isSelected: boolean;
  isDefault: boolean;
}
