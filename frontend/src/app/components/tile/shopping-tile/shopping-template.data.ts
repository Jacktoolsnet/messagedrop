import { ShoppingUnit } from '../../../interfaces/tile-settings';

export interface ShoppingProductTemplate {
  id: string;
  quantity: number;
  unit: ShoppingUnit;
}

export interface ShoppingCategoryTemplate {
  id: string;
  products: ShoppingProductTemplate[];
}

export interface ShoppingStoreTemplate {
  id: string;
  icon: string;
  categories: ShoppingCategoryTemplate[];
}

const product = (id: string, unit: ShoppingUnit = 'package', quantity = 1): ShoppingProductTemplate => ({ id, unit, quantity });

export const SHOPPING_STORE_TEMPLATES: readonly ShoppingStoreTemplate[] = [
  {
    id: 'supermarket', icon: 'local_grocery_store', categories: [
      { id: 'fruitVegetables', products: [product('apples', 'kilogram'), product('bananas', 'kilogram'), product('potatoes', 'kilogram'), product('onions', 'kilogram'), product('tomatoes', 'kilogram')] },
      { id: 'bakery', products: [product('bread', 'piece'), product('rolls', 'piece', 4), product('toast')] },
      { id: 'dairy', products: [product('milk', 'liter'), product('butter'), product('cheese'), product('yogurt'), product('eggs')] },
      { id: 'meat', products: [product('chicken'), product('coldCuts'), product('sausages')] },
      { id: 'pantry', products: [product('flour', 'kilogram'), product('sugar', 'kilogram'), product('rice', 'kilogram'), product('pasta'), product('cookingOil', 'bottle')] },
      { id: 'drinks', products: [product('water', 'bottle'), product('juice', 'bottle'), product('coffee'), product('tea')] },
      { id: 'frozen', products: [product('pizza'), product('frozenVegetables'), product('iceCream')] },
      { id: 'household', products: [product('toiletPaper'), product('kitchenRoll'), product('trashBags'), product('dishSoap', 'bottle')] }
    ]
  },
  {
    id: 'drugstore', icon: 'health_and_beauty', categories: [
      { id: 'bodyCare', products: [product('showerGel', 'bottle'), product('soap', 'piece'), product('deodorant', 'piece'), product('bodyLotion', 'bottle')] },
      { id: 'hairCare', products: [product('shampoo', 'bottle'), product('conditioner', 'bottle'), product('hairSpray', 'can')] },
      { id: 'dentalCare', products: [product('toothpaste', 'piece'), product('toothbrush', 'piece'), product('dentalFloss', 'piece'), product('mouthwash', 'bottle')] },
      { id: 'cleaning', products: [product('allPurposeCleaner', 'bottle'), product('laundryDetergent'), product('sponges'), product('cleaningCloths')] },
      { id: 'paperGoods', products: [product('toiletPaper'), product('tissues'), product('kitchenRoll')] }
    ]
  },
  {
    id: 'hardwareStore', icon: 'hardware', categories: [
      { id: 'tools', products: [product('hammer', 'piece'), product('screwdriver', 'piece'), product('pliers', 'piece'), product('tapeMeasure', 'piece')] },
      { id: 'fasteners', products: [product('screws'), product('nails'), product('dowels'), product('adhesive', 'piece')] },
      { id: 'paint', products: [product('wallPaint', 'can'), product('brushes', 'piece'), product('paintRollers', 'piece'), product('maskingTape', 'piece')] },
      { id: 'electrical', products: [product('lightBulbs'), product('batteries'), product('extensionCord', 'piece'), product('powerStrip', 'piece')] },
      { id: 'garden', products: [product('pottingSoil', 'bag'), product('fertilizer'), product('gardenGloves'), product('plantPots', 'piece')] }
    ]
  },
  {
    id: 'petStore', icon: 'pets', categories: [
      { id: 'dog', products: [product('dogFood', 'bag'), product('dogTreats'), product('wasteBags'), product('dogToy', 'piece')] },
      { id: 'cat', products: [product('catFood'), product('catLitter', 'bag'), product('catTreats'), product('catToy', 'piece')] },
      { id: 'smallAnimals', products: [product('hay', 'bag'), product('bedding', 'bag'), product('smallAnimalFood', 'bag'), product('smallAnimalTreats')] },
      { id: 'petCare', products: [product('fleaTreatment'), product('petShampoo', 'bottle'), product('petBrush', 'piece')] }
    ]
  }
];
