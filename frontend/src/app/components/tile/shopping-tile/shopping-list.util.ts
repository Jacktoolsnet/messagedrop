import {
  ShoppingCategory,
  ShoppingList,
  ShoppingProduct,
  ShoppingUnit
} from '../../../interfaces/tile-settings';

export const SHOPPING_UNITS: readonly ShoppingUnit[] = [
  'piece',
  'package',
  'gram',
  'kilogram',
  'milliliter',
  'liter',
  'bottle',
  'can',
  'jar',
  'bag',
  'bunch'
];

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
      image: typeof category.image === 'string' && category.image.startsWith('data:image/') ? category.image : undefined,
      imageFileId: typeof category.imageFileId === 'string' && category.imageFileId.trim() ? category.imageFileId : undefined,
      imageAttribution: category.imageAttribution?.source === 'unsplash' ? category.imageAttribution : undefined,
      backgroundImage: typeof category.backgroundImage === 'string' && category.backgroundImage.startsWith('data:image/')
        ? category.backgroundImage
        : undefined,
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

function normalizeProducts(products?: ShoppingProduct[]): ShoppingProduct[] {
  return (products ?? [])
    .map((product, productIndex): ShoppingProduct => ({
      id: product.id || createShoppingId('product'),
      templateKey: typeof product.templateKey === 'string' && product.templateKey.trim() ? product.templateKey : undefined,
      name: (product.name ?? '').trim(),
      notes: typeof product.notes === 'string' && product.notes.trim() ? product.notes.trim() : undefined,
      image: typeof product.image === 'string' && product.image.startsWith('data:image/') ? product.image : undefined,
      imageFileId: typeof product.imageFileId === 'string' && product.imageFileId.trim() ? product.imageFileId : undefined,
      imageAttribution: product.imageAttribution?.source === 'unsplash' ? product.imageAttribution : undefined,
      quantity: Number.isFinite(product.quantity) && product.quantity > 0 ? product.quantity : 1,
      unit: SHOPPING_UNITS.includes(product.unit) ? product.unit : 'piece',
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
