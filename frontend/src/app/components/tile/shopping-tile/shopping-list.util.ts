import {
  ShoppingCategory,
  ShoppingList,
  ShoppingProduct,
  ShoppingUnit
} from '../../../interfaces/tile-settings';

export interface ShoppingUnitConfig {
  unit: ShoppingUnit;
  allowDecimals: boolean;
}

export const SHOPPING_UNIT_CONFIGS: readonly ShoppingUnitConfig[] = [
  { unit: 'piece', allowDecimals: false },
  { unit: 'package', allowDecimals: false },
  { unit: 'gram', allowDecimals: false },
  { unit: 'kilogram', allowDecimals: true },
  { unit: 'milliliter', allowDecimals: false },
  { unit: 'liter', allowDecimals: true },
  { unit: 'bottle', allowDecimals: false },
  { unit: 'can', allowDecimals: false },
  { unit: 'jar', allowDecimals: false },
  { unit: 'bag', allowDecimals: false },
  { unit: 'bunch', allowDecimals: false }
];

export const SHOPPING_UNITS: readonly ShoppingUnit[] = SHOPPING_UNIT_CONFIGS.map(config => config.unit);

export const DEFAULT_SHOPPING_SELECTION_COLOR = '#4fa1c7';

export function createShoppingId(prefix: 'category' | 'product'): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function normalizeShoppingList(value?: ShoppingList): ShoppingList {
  const categories = (value?.categories ?? [])
    .map((category, categoryIndex): ShoppingCategory => ({
      id: category.id || createShoppingId('category'),
      templateKey: typeof category.templateKey === 'string' && category.templateKey.trim() ? category.templateKey : undefined,
      name: (category.name ?? '').trim(),
      image: normalizeImageUrl(category.image),
      imageFileId: typeof category.imageFileId === 'string' && category.imageFileId.trim() ? category.imageFileId : undefined,
      imageAttribution: category.imageAttribution?.source === 'unsplash' ? category.imageAttribution : undefined,
      backgroundImage: normalizeImageUrl(category.backgroundImage),
      backgroundImageFileId: typeof category.backgroundImageFileId === 'string' && category.backgroundImageFileId.trim()
        ? category.backgroundImageFileId
        : undefined,
      backgroundAttribution: category.backgroundAttribution?.source === 'unsplash' ? category.backgroundAttribution : undefined,
      backgroundTransparency: Number.isFinite(category.backgroundTransparency)
        ? Math.min(100, Math.max(0, category.backgroundTransparency ?? 40))
        : 40,
      order: Number.isFinite(category.order) ? category.order : categoryIndex,
      products: normalizeProducts(category.products)
    }))
    .filter(category => category.name !== '')
    .sort((a, b) => a.order - b.order)
    .map((category, order) => ({ ...category, order }));

  return {
    categories,
    currency: value?.currency?.trim().toUpperCase() || 'EUR',
    selectionColor: /^#[0-9a-f]{6}$/i.test(value?.selectionColor ?? '')
      ? value?.selectionColor
      : DEFAULT_SHOPPING_SELECTION_COLOR
  };
}

export function shoppingUnitAllowsDecimals(unit: ShoppingUnit): boolean {
  return SHOPPING_UNIT_CONFIGS.find(config => config.unit === unit)?.allowDecimals ?? false;
}

export function normalizeShoppingQuantity(quantity: number | string | null | undefined, unit: ShoppingUnit): number {
  const value = Number(quantity);
  if (!Number.isFinite(value) || value <= 0) return 1;
  if (shoppingUnitAllowsDecimals(unit)) {
    return Math.max(0.01, Math.round(value * 100) / 100);
  }
  return Math.max(1, Math.round(value));
}


function normalizeImageUrl(value: string | undefined): string | undefined {
  return typeof value === 'string' && /^(data:image\/|https?:\/\/)/i.test(value) ? value : undefined;
}

function normalizeProducts(products?: ShoppingProduct[]): ShoppingProduct[] {
  return (products ?? [])
    .map((product, productIndex): ShoppingProduct => ({
      id: product.id || createShoppingId('product'),
      templateKey: typeof product.templateKey === 'string' && product.templateKey.trim() ? product.templateKey : undefined,
      name: (product.name ?? '').trim(),
      notes: typeof product.notes === 'string' && product.notes.trim() ? product.notes.trim() : undefined,
      image: normalizeImageUrl(product.image),
      imageFileId: typeof product.imageFileId === 'string' && product.imageFileId.trim() ? product.imageFileId : undefined,
      imageAttribution: product.imageAttribution?.source === 'unsplash' ? product.imageAttribution : undefined,
      unit: SHOPPING_UNITS.includes(product.unit) ? product.unit : 'piece',
      quantity: normalizeShoppingQuantity(product.quantity, SHOPPING_UNITS.includes(product.unit) ? product.unit : 'piece'),
      price: Number.isFinite(product.price) && (product.price ?? -1) >= 0 ? product.price : undefined,
      needed: !!product.needed,
      done: !!product.needed && !!product.done,
      order: Number.isFinite(product.order) ? product.order : productIndex
    }))
    .filter(product => product.name !== '')
    .sort((a, b) => a.order - b.order)
    .map((product, order) => ({ ...product, order }));
}

export function activeShoppingProducts(list: ShoppingList): ShoppingProduct[] {
  return list.categories.flatMap(category => category.products.filter(product => product.needed));
}
