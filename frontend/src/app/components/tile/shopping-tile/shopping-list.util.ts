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
      name: (category.name ?? '').trim(),
      image: typeof category.image === 'string' && category.image.startsWith('data:image/') ? category.image : undefined,
      order: Number.isFinite(category.order) ? category.order : categoryIndex,
      products: normalizeProducts(category.products)
    }))
    .filter(category => category.name !== '')
    .sort((a, b) => a.order - b.order)
    .map((category, order) => ({ ...category, order }));

  return {
    categories,
    currency: value?.currency?.trim().toUpperCase() || 'EUR'
  };
}

function normalizeProducts(products?: ShoppingProduct[]): ShoppingProduct[] {
  return (products ?? [])
    .map((product, productIndex): ShoppingProduct => ({
      id: product.id || createShoppingId('product'),
      name: (product.name ?? '').trim(),
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
