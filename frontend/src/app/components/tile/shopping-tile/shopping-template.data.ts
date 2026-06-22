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
      { id: 'fruit', products: [product('apples', 'kilogram'), product('bananas', 'kilogram'), product('berries'), product('grapes', 'kilogram'), product('kiwis', 'piece'), product('lemons', 'piece'), product('oranges', 'kilogram'), product('pears', 'kilogram')] },
      { id: 'vegetables', products: [product('avocados', 'piece'), product('broccoli', 'piece'), product('carrots', 'kilogram'), product('cucumbers', 'piece'), product('garlic'), product('lettuce', 'piece'), product('mushrooms'), product('onions', 'kilogram'), product('peppers'), product('potatoes', 'kilogram'), product('tomatoes', 'kilogram'), product('zucchini', 'piece')] },
      { id: 'bakery', products: [product('baguette', 'piece'), product('bread', 'piece'), product('cake'), product('crispbread'), product('rolls', 'piece', 4), product('toast'), product('wraps')] },
      { id: 'dairy', products: [product('butter'), product('cheese'), product('cream'), product('creamCheese'), product('eggs'), product('milk', 'liter'), product('quark'), product('sourCream'), product('yogurt')] },
      { id: 'meat', products: [product('beef'), product('chicken'), product('coldCuts'), product('groundMeat'), product('ham'), product('pork'), product('sausages')] },
      { id: 'fish', products: [product('fishFillet'), product('salmon'), product('seafood'), product('smokedFish'), product('tuna')] },
      { id: 'breakfast', products: [product('cereal'), product('coffee'), product('honey', 'jar'), product('jam', 'jar'), product('muesli'), product('tea')] },
      { id: 'pantry', products: [product('cookingOil', 'bottle'), product('flour', 'kilogram'), product('pasta'), product('rice', 'kilogram'), product('salt'), product('sugar', 'kilogram'), product('vinegar', 'bottle')] },
      { id: 'cannedGoods', products: [product('beans', 'can'), product('cannedCorn', 'can'), product('cannedTomatoes', 'can'), product('chickpeas', 'can'), product('coconutMilk', 'can'), product('soups', 'can')] },
      { id: 'spicesSauces', products: [product('herbs'), product('ketchup', 'bottle'), product('mayonnaise', 'jar'), product('mustard', 'jar'), product('pepper'), product('spices'), product('tomatoSauce', 'jar')] },
      { id: 'snacksSweets', products: [product('biscuits'), product('chips'), product('chocolate'), product('gummyCandy'), product('nuts'), product('popcorn')] },
      { id: 'drinks', products: [product('beer', 'bottle'), product('juice', 'bottle'), product('lemonade', 'bottle'), product('softDrinks', 'bottle'), product('water', 'bottle'), product('wine', 'bottle')] },
      { id: 'frozen', products: [product('fishSticks'), product('frozenFruit'), product('frozenVegetables'), product('iceCream'), product('pizza'), product('readyMeals')] },
      { id: 'household', products: [product('aluminumFoil'), product('bakingPaper'), product('dishSoap', 'bottle'), product('kitchenRoll'), product('trashBags'), product('toiletPaper')] }
    ]
  },
  {
    id: 'drugstore', icon: 'health_and_beauty', categories: [
      { id: 'bodyCare', products: [product('bodyLotion', 'bottle'), product('deodorant', 'piece'), product('handCream'), product('razors'), product('shavingFoam', 'can'), product('showerGel', 'bottle'), product('soap', 'piece'), product('sunscreen', 'bottle')] },
      { id: 'hairCare', products: [product('conditioner', 'bottle'), product('hairColor'), product('hairGel'), product('hairSpray', 'can'), product('hairTreatment'), product('shampoo', 'bottle')] },
      { id: 'dentalCare', products: [product('dentalFloss', 'piece'), product('interdentalBrushes'), product('mouthwash', 'bottle'), product('toothbrush', 'piece'), product('toothpaste', 'piece')] },
      { id: 'facialCare', products: [product('cleansingGel', 'bottle'), product('cottonPads'), product('faceCream'), product('faceMasks'), product('lipCare'), product('makeupRemover', 'bottle')] },
      { id: 'personalHygiene', products: [product('condoms'), product('cottonSwabs'), product('incontinenceProducts'), product('sanitaryPads'), product('tampons'), product('wetWipes')] },
      { id: 'babyCare', products: [product('babyFood'), product('babyOil', 'bottle'), product('babyWipes'), product('diapers'), product('nursingPads'), product('rashCream')] },
      { id: 'cleaning', products: [product('allPurposeCleaner', 'bottle'), product('bathroomCleaner', 'bottle'), product('cleaningCloths'), product('dishwasherTablets'), product('glassCleaner', 'bottle'), product('sponges'), product('toiletCleaner', 'bottle')] },
      { id: 'laundry', products: [product('fabricSoftener', 'bottle'), product('laundryDetergent'), product('laundryDisinfectant', 'bottle'), product('stainRemover'), product('washingBags')] },
      { id: 'paperGoods', products: [product('facialTissues'), product('kitchenRoll'), product('napkins'), product('tissues'), product('toiletPaper')] }
    ]
  },
  {
    id: 'hardwareStore', icon: 'hardware', categories: [
      { id: 'tools', products: [product('cordlessDrill', 'piece'), product('hammer', 'piece'), product('level', 'piece'), product('pliers', 'piece'), product('screwdriver', 'piece'), product('tapeMeasure', 'piece'), product('utilityKnife', 'piece'), product('wrench', 'piece')] },
      { id: 'fasteners', products: [product('adhesive', 'piece'), product('cableTies'), product('dowels'), product('hooks'), product('nails'), product('nuts'), product('screws'), product('washers')] },
      { id: 'paint', products: [product('brushes', 'piece'), product('filler'), product('maskingTape', 'piece'), product('paintRollers', 'piece'), product('sandpaper'), product('varnish', 'can'), product('wallPaint', 'can')] },
      { id: 'electrical', products: [product('batteries'), product('cables'), product('extensionCord', 'piece'), product('fuses'), product('lightBulbs'), product('powerStrip', 'piece'), product('sockets'), product('switches')] },
      { id: 'plumbing', products: [product('faucet', 'piece'), product('fittings'), product('pipeSealTape', 'piece'), product('pipes'), product('plunger', 'piece'), product('seals')] },
      { id: 'buildingMaterials', products: [product('cement', 'bag'), product('drywall'), product('insulation'), product('mortar', 'bag'), product('silicone', 'piece'), product('wood')] },
      { id: 'garden', products: [product('fertilizer'), product('gardenGloves'), product('gardenTools'), product('plantPots', 'piece'), product('pottingSoil', 'bag'), product('seeds'), product('wateringCan', 'piece')] },
      { id: 'safety', products: [product('dustMasks'), product('earProtection'), product('safetyGlasses', 'piece'), product('workGloves'), product('workShoes')] }
    ]
  },
  {
    id: 'petStore', icon: 'pets', categories: [
      { id: 'dog', products: [product('dogFood', 'bag'), product('dogLeash', 'piece'), product('dogTreats'), product('dogToy', 'piece'), product('foodBowl', 'piece'), product('wasteBags')] },
      { id: 'cat', products: [product('catFood'), product('catLitter', 'bag'), product('catTreats'), product('catToy', 'piece'), product('litterBox', 'piece'), product('scratchingPost', 'piece')] },
      { id: 'smallAnimals', products: [product('bedding', 'bag'), product('hay', 'bag'), product('smallAnimalFood', 'bag'), product('smallAnimalTreats'), product('waterBottle', 'piece')] },
      { id: 'birds', products: [product('birdFood', 'bag'), product('birdSand', 'bag'), product('birdTreats'), product('cuttlebone', 'piece'), product('perches')] },
      { id: 'aquarium', products: [product('aquariumFilter'), product('fishFood'), product('gravel', 'bag'), product('waterConditioner', 'bottle'), product('waterTest')] },
      { id: 'petCare', products: [product('fleaTreatment'), product('petBrush', 'piece'), product('petShampoo', 'bottle'), product('tickRemover', 'piece'), product('wormingTreatment')] }
    ]
  }
];
