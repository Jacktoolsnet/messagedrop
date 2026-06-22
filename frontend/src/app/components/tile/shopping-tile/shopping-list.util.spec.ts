import { ShoppingList } from '../../../interfaces/tile-settings';
import { activeShoppingProducts, normalizeShoppingList } from './shopping-list.util';

describe('shopping list utilities', () => {
  it('normalizes category and product order while preserving the master list', () => {
    const list: ShoppingList = {
      currency: 'eur',
      categories: [
        {
          id: 'second',
          name: ' Bakery ',
          imageFileId: 'category-image',
          backgroundImageFileId: 'category-background',
          order: 2,
          products: [{
            id: 'bread',
            name: ' Bread ',
            imageFileId: 'product-image',
            quantity: 0,
            unit: 'piece',
            price: -1,
            needed: false,
            done: true,
            order: 4
          }]
        },
        { id: 'first', name: 'Fruit', order: 0, products: [] }
      ]
    };

    const normalized = normalizeShoppingList(list);

    expect(normalized.currency).toBe('EUR');
    expect(normalized.categories.map(category => category.id)).toEqual(['first', 'second']);
    expect(normalized.categories[1].products[0]).toEqual(jasmine.objectContaining({
      name: 'Bread', imageFileId: 'product-image', quantity: 1, price: undefined, needed: false, done: false, order: 0
    }));
    expect(normalized.categories[1]).toEqual(jasmine.objectContaining({
      imageFileId: 'category-image', backgroundImageFileId: 'category-background'
    }));
  });

  it('returns only products selected for the current shopping trip', () => {
    const list = normalizeShoppingList({
      currency: 'EUR',
      categories: [{
        id: 'food',
        name: 'Food',
        order: 0,
        products: [
          { id: 'milk', name: 'Milk', quantity: 1, unit: 'liter', needed: true, done: false, order: 0 },
          { id: 'sugar', name: 'Sugar', quantity: 1, unit: 'package', needed: false, done: false, order: 1 }
        ]
      }]
    });

    expect(activeShoppingProducts(list).map(product => product.id)).toEqual(['milk']);
  });
});
