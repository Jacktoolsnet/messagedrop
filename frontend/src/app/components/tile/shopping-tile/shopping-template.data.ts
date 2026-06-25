import { AvatarAttribution } from '../../../interfaces/avatar-attribution';
import { ShoppingUnit } from '../../../interfaces/tile-settings';
import { DRUGSTORE_PRODUCT_IMAGES } from './shopping-drugstore-product-images.data';
import { HARDWARE_STORE_PRODUCT_IMAGES } from './shopping-hardware-product-images.data';

export interface ShoppingProductTemplate {
  id: string;
  quantity: number;
  unit: ShoppingUnit;
  image?: AvatarAttribution;
}

export interface ShoppingCategoryTemplate {
  id: string;
  image?: AvatarAttribution;
  backgroundImage?: AvatarAttribution;
  products: ShoppingProductTemplate[];
}

export interface ShoppingStoreTemplate {
  id: string;
  icon: string;
  categories: ShoppingCategoryTemplate[];
}

const product = (id: string, unit: ShoppingUnit = 'package', quantity = 1, image?: AvatarAttribution): ShoppingProductTemplate => ({ id, unit, quantity, image });

const supermarketCategoryImage = (id: string): AvatarAttribution | undefined => SUPERMARKET_CATEGORY_IMAGES[id];

const SUPERMARKET_CATEGORY_IMAGES: Record<string, AvatarAttribution> = {
  bakery: {
    source: 'unsplash',
    authorName: 'Paul Hermann',
    authorUrl: 'https://unsplash.com/de/@plhrmnn?utm_source=messagedrop&utm_medium=referral',
    unsplashUrl: 'https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral',
    photoUrl: 'https://unsplash.com/photos/breads-in-basket-rLJflZ_ufpo?utm_source=messagedrop&utm_medium=referral',
    imageUrl: 'https://images.unsplash.com/photo-1508616185939-efe767994166?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwzfHxCciVDMyVCNnRjaGVufGVufDB8fHx8MTc4MjIxMjMxNXww&ixlib=rb-4.1.0&q=80&w=1080',
    downloadLocation: 'https://api.unsplash.com/photos/rLJflZ_ufpo/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwzfHxCciVDMyVCNnRjaGVufGVufDB8fHx8MTc4MjIxMjMxNXww'
  },
  fish: {
    source: 'unsplash',
    authorName: 'Anastasiia Mitiushova',
    authorUrl: 'https://unsplash.com/de/@mitiushova?utm_source=messagedrop&utm_medium=referral',
    unsplashUrl: 'https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral',
    photoUrl: 'https://unsplash.com/photos/a-bunch-of-boxes-filled-with-lots-of-different-types-of-food-qDMG3aBFUmY?utm_source=messagedrop&utm_medium=referral',
    imageUrl: 'https://images.unsplash.com/photo-1715888167739-719cfbb8e5cc?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxMXx8TWVlcmVzZnIlQzMlQkNjaHRlfGVufDB8fHx8MTc4MjIxMjEzMXww&ixlib=rb-4.1.0&q=80&w=1080',
    downloadLocation: 'https://api.unsplash.com/photos/qDMG3aBFUmY/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxMXx8TWVlcmVzZnIlQzMlQkNjaHRlfGVufDB8fHx8MTc4MjIxMjEzMXww'
  },
  meat: {
    source: 'unsplash',
    authorName: 'Eiliv Aceron',
    authorUrl: 'https://unsplash.com/de/@shootdelicious?utm_source=messagedrop&utm_medium=referral',
    unsplashUrl: 'https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral',
    photoUrl: 'https://unsplash.com/photos/raw-meat-on-white-ceramic-plate-YlAmh_X_SsE?utm_source=messagedrop&utm_medium=referral',
    imageUrl: 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxfHxGbGVpc2NofGVufDB8fHx8MTc4MjIxMjQ5NHww&ixlib=rb-4.1.0&q=80&w=1080',
    downloadLocation: 'https://api.unsplash.com/photos/YlAmh_X_SsE/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxfHxGbGVpc2NofGVufDB8fHx8MTc4MjIxMjQ5NHww'
  },
  breakfast: {
    source: 'unsplash',
    authorName: 'Ali Inay',
    authorUrl: 'https://unsplash.com/de/@inayali?utm_source=messagedrop&utm_medium=referral',
    unsplashUrl: 'https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral',
    photoUrl: 'https://unsplash.com/photos/variety-of-foods-on-top-of-gray-table-y3aP9oo9Pjc?utm_source=messagedrop&utm_medium=referral',
    imageUrl: 'https://images.unsplash.com/photo-1424847651672-bf20a4b0982b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxNnx8RnIlQzMlQkNoc3QlQzMlQkNja3xlbnwwfHx8fDE3ODIyMTI1MzR8MA&ixlib=rb-4.1.0&q=80&w=1080',
    downloadLocation: 'https://api.unsplash.com/photos/y3aP9oo9Pjc/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxNnx8RnIlQzMlQkNoc3QlQzMlQkNja3xlbnwwfHx8fDE3ODIyMTI1MzR8MA'
  },
  vegetables: {
    source: 'unsplash',
    authorName: 'Sharon Pittaway',
    authorUrl: 'https://unsplash.com/de/@sharonp?utm_source=messagedrop&utm_medium=referral',
    unsplashUrl: 'https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral',
    photoUrl: 'https://unsplash.com/photos/assorted-vegetables-KUZnfk-2DSQ?utm_source=messagedrop&utm_medium=referral',
    imageUrl: 'https://images.unsplash.com/photo-1518843875459-f738682238a6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHw4fHxHZW0lQzMlQkNzZXxlbnwwfHx8fDE3ODIyMTI2MDN8MA&ixlib=rb-4.1.0&q=80&w=1080',
    downloadLocation: 'https://api.unsplash.com/photos/KUZnfk-2DSQ/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHw4fHxHZW0lQzMlQkNzZXxlbnwwfHx8fDE3ODIyMTI2MDN8MA'
  },
  drinks: {
    source: 'unsplash',
    authorName: 'Tanya Paquet',
    authorUrl: 'https://unsplash.com/de/@tanyapaquet?utm_source=messagedrop&utm_medium=referral',
    unsplashUrl: 'https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral',
    photoUrl: 'https://unsplash.com/photos/a-group-of-bottles-xuiXFo1Ni5k?utm_source=messagedrop&utm_medium=referral',
    imageUrl: 'https://images.unsplash.com/photo-1662309375911-b1d722672448?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwyNXx8R2V0ciVDMyVBNG5rZXxlbnwwfHx8fDE3ODIyMTI2NDB8MA&ixlib=rb-4.1.0&q=80&w=1080',
    downloadLocation: 'https://api.unsplash.com/photos/xuiXFo1Ni5k/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwyNXx8R2V0ciVDMyVBNG5rZXxlbnwwfHx8fDE3ODIyMTI2NDB8MA'
  },
  spicesSauces: {
    source: 'unsplash',
    authorName: 'Tamanna Rumee',
    authorUrl: 'https://unsplash.com/de/@tamanna_rumee?utm_source=messagedrop&utm_medium=referral',
    unsplashUrl: 'https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral',
    photoUrl: 'https://unsplash.com/photos/brown-powder-on-silver-spoon-dqVPEGkuR_U?utm_source=messagedrop&utm_medium=referral',
    imageUrl: 'https://images.unsplash.com/photo-1606914469633-bd39206ea739?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHw2fHxHZXclQzMlQkNyemV8ZW58MHx8fHwxNzgyMjEyNjgyfDA&ixlib=rb-4.1.0&q=80&w=1080',
    downloadLocation: 'https://api.unsplash.com/photos/dqVPEGkuR_U/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHw2fHxHZXclQzMlQkNyemV8ZW58MHx8fHwxNzgyMjEyNjgyfDA'
  },
  household: {
    source: 'unsplash',
    authorName: 'Annie Spratt',
    authorUrl: 'https://unsplash.com/de/@anniespratt?utm_source=messagedrop&utm_medium=referral',
    unsplashUrl: 'https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral',
    photoUrl: 'https://unsplash.com/photos/black-frying-pan-on-stove-VI1Je4Rc8bg?utm_source=messagedrop&utm_medium=referral',
    imageUrl: 'https://images.unsplash.com/photo-1604762433261-a046add6fc11?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwzfHxIYXVzaGFsdHxlbnwwfHx8fDE3ODIyMTI3MTZ8MA&ixlib=rb-4.1.0&q=80&w=1080',
    downloadLocation: 'https://api.unsplash.com/photos/VI1Je4Rc8bg/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwzfHxIYXVzaGFsdHxlbnwwfHx8fDE3ODIyMTI3MTZ8MA'
  },
  cannedGoods: {
    source: 'unsplash',
    authorName: 'Ricky Lin',
    authorUrl: 'https://unsplash.com/de/@forone?utm_source=messagedrop&utm_medium=referral',
    unsplashUrl: 'https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral',
    photoUrl: 'https://unsplash.com/photos/lots-of-agustson-cans-wf4y1q0PMH8?utm_source=messagedrop&utm_medium=referral',
    imageUrl: 'https://images.unsplash.com/photo-1548341636-7ca4cbaa95ac?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxMHx8S29uc2VydmVufGVufDB8fHx8MTc4MjIxMjc2NXww&ixlib=rb-4.1.0&q=80&w=1080',
    downloadLocation: 'https://api.unsplash.com/photos/wf4y1q0PMH8/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxMHx8S29uc2VydmVufGVufDB8fHx8MTc4MjIxMjc2NXww'
  },
  dairy: {
    source: 'unsplash',
    authorName: 'Melina Kiefer',
    authorUrl: 'https://unsplash.com/de/@melimascella_?utm_source=messagedrop&utm_medium=referral',
    unsplashUrl: 'https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral',
    photoUrl: 'https://unsplash.com/photos/a-wooden-cutting-board-topped-with-blueberries-next-to-a-jar-of-yogurt-sq_xrnlu5z8?utm_source=messagedrop&utm_medium=referral',
    imageUrl: 'https://images.unsplash.com/photo-1632510235288-7c38c7ec27a8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxMnx8Sm9naHVydHxlbnwwfHx8fDE3ODIyMTI4NDN8MA&ixlib=rb-4.1.0&q=80&w=1080',
    downloadLocation: 'https://api.unsplash.com/photos/sq_xrnlu5z8/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxMnx8Sm9naHVydHxlbnwwfHx8fDE3ODIyMTI4NDN8MA'
  },
  fruit: {
    source: 'unsplash',
    authorName: 'Julia Zolotova',
    authorUrl: 'https://unsplash.com/de/@juliazolotova?utm_source=messagedrop&utm_medium=referral',
    unsplashUrl: 'https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral',
    photoUrl: 'https://unsplash.com/photos/sliced-orange-fruit-and-green-round-fruits-M_xIaxQE3Ms?utm_source=messagedrop&utm_medium=referral',
    imageUrl: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHw1fHxPYnN0fGVufDB8fHx8MTc4MjIxMjg5M3ww&ixlib=rb-4.1.0&q=80&w=1080',
    downloadLocation: 'https://api.unsplash.com/photos/M_xIaxQE3Ms/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHw1fHxPYnN0fGVufDB8fHx8MTc4MjIxMjg5M3ww'
  },
  snacksSweets: {
    source: 'unsplash',
    authorName: 'Matt Schwartz',
    authorUrl: 'https://unsplash.com/de/@mattschwartz?utm_source=messagedrop&utm_medium=referral',
    unsplashUrl: 'https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral',
    photoUrl: 'https://unsplash.com/photos/assorted-color-sweet-treats-in-red-and-blue-plastic-trays-SmZWvAkKRVM?utm_source=messagedrop&utm_medium=referral',
    imageUrl: 'https://images.unsplash.com/photo-1507696460378-fc372bb90ed3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwyMnx8cyVDMyVCQyVDMyU5Rmlna2VpdGVufGVufDB8fHx8MTc4MjIxMjk4Nnww&ixlib=rb-4.1.0&q=80&w=1080',
    downloadLocation: 'https://api.unsplash.com/photos/SmZWvAkKRVM/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwyMnx8cyVDMyVCQyVDMyU5Rmlna2VpdGVufGVufDB8fHx8MTc4MjIxMjk4Nnww'
  },
  frozen: {
    source: 'unsplash',
    authorName: 'Eduardo Soares',
    authorUrl: 'https://unsplash.com/de/@eduschadesoares?utm_source=messagedrop&utm_medium=referral',
    unsplashUrl: 'https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral',
    photoUrl: 'https://unsplash.com/photos/blue-and-white-labeled-box-_TWuQeTq-GY?utm_source=messagedrop&utm_medium=referral',
    imageUrl: 'https://images.unsplash.com/photo-1601599964574-cddabfa36549?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwyMXx8VGllZmslQzMlQkNobHByb2R1a3RlfGVufDB8fHx8MTc4MjIxMzAyMXww&ixlib=rb-4.1.0&q=80&w=1080',
    downloadLocation: 'https://api.unsplash.com/photos/_TWuQeTq-GY/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwyMXx8VGllZmslQzMlQkNobHByb2R1a3RlfGVufDB8fHx8MTc4MjIxMzAyMXww'
  },
  pantry: {
    source: 'unsplash',
    authorName: 'Margit Umbach',
    authorUrl: 'https://unsplash.com/de/@margitsunnysideup?utm_source=messagedrop&utm_medium=referral',
    unsplashUrl: 'https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral',
    photoUrl: 'https://unsplash.com/photos/the-original-ground-coffee-box-YKwob6chiOA?utm_source=messagedrop&utm_medium=referral',
    imageUrl: 'https://images.unsplash.com/photo-1609240633503-15a21c8b28c2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHw4fHxnZXN0YXBlbHRlJTIwZG9zZW58ZW58MHx8fHwxNzgyMjEzMTE4fDA&ixlib=rb-4.1.0&q=80&w=1080',
    downloadLocation: 'https://api.unsplash.com/photos/YKwob6chiOA/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHw4fHxnZXN0YXBlbHRlJTIwZG9zZW58ZW58MHx8fHwxNzgyMjEzMTE4fDA'
  }
};


const supermarketProductImage = (id: string): AvatarAttribution | undefined => SUPERMARKET_PRODUCT_IMAGES[id];

const supermarketProduct = (id: string, unit: ShoppingUnit = 'package', quantity = 1): ShoppingProductTemplate =>
  product(id, unit, quantity, supermarketProductImage(id));

const SUPERMARKET_PRODUCT_IMAGES: Record<string, AvatarAttribution> = {
  baguette: {
    source: "unsplash",
    authorName: "Ilham Putra",
    authorUrl: "https://unsplash.com/de/@ilham_ps?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/a-loaf-of-bread-sitting-on-top-of-a-black-counter-kDbrTtBUqyI?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1691862469732-a7aefa09279b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxNnx8QmFndWV0dGV8ZW58MHx8fHwxNzgyMjIxMzkxfDA&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/kDbrTtBUqyI/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxNnx8QmFndWV0dGV8ZW58MHx8fHwxNzgyMjIxMzkxfDA"
  },
  bread: {
    source: "unsplash",
    authorName: "Wesual Click",
    authorUrl: "https://unsplash.com/de/@wesual?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/cereal-and-three-buns-rsWZ-P9FbQ4?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1509440159596-0249088772ff?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxfHxCcm90fGVufDB8fHx8MTc4MjIyMTQ1OHww&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/rsWZ-P9FbQ4/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxfHxCcm90fGVufDB8fHx8MTc4MjIyMTQ1OHww"
  },
  rolls: {
    source: "unsplash",
    authorName: "Paul Hermann",
    authorUrl: "https://unsplash.com/de/@plhrmnn?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/breads-in-basket-rLJflZ_ufpo?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1508616185939-efe767994166?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwzfHxCciVDMyVCNnRjaGVufGVufDB8fHx8MTc4MjIxMjMxNXww&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/rLJflZ_ufpo/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwzfHxCciVDMyVCNnRjaGVufGVufDB8fHx8MTc4MjIxMjMxNXww"
  },
  crispbread: {
    source: "unsplash",
    authorName: "Tamanna Rumee",
    authorUrl: "https://unsplash.com/de/@tamanna_rumee?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/chocolate-bark-with-pistachios-and-nuts-on-a-plate-hx9gt7bKvTI?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1772986207588-0e6318f547bf?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxMnx8S24lQzMlQTRja2Vicm90fGVufDB8fHx8MTc4MjIyMTUwOXww&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/hx9gt7bKvTI/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxMnx8S24lQzMlQTRja2Vicm90fGVufDB8fHx8MTc4MjIyMTUwOXww"
  },
  cake: {
    source: "unsplash",
    authorName: "Jasmine Bartel",
    authorUrl: "https://unsplash.com/de/@jasminesky?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/baked-strawberry-cake-8LtrMQfeDkQ?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1568827999250-3f6afff96e66?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxNXx8S3VjaGVufGVufDB8fHx8MTc4MjIyMTU4M3ww&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/8LtrMQfeDkQ/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxNXx8S3VjaGVufGVufDB8fHx8MTc4MjIyMTU4M3ww"
  },
  toast: {
    source: "unsplash",
    authorName: "Mishaal Zahed (Meschael Zahède)",
    authorUrl: "https://unsplash.com/de/@mishaalzahed?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/brown-and-black-bread-on-white-ceramic-plate-Xm-oNioQsZg?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1612827788868-c8632040ab64?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxfHxUb3N0YnJvdHxlbnwwfHx8fDE3ODIyMjE2MTZ8MA&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/Xm-oNioQsZg/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxfHxUb3N0YnJvdHxlbnwwfHx8fDE3ODIyMjE2MTZ8MA"
  },
  wraps: {
    source: "unsplash",
    authorName: "Max Griss",
    authorUrl: "https://unsplash.com/de/@grissphoto?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/white-and-brown-food-on-white-ceramic-plate-Spp1G283dow?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1626700051175-6818013e1d4f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxfHxXcmFwc3xlbnwwfHx8fDE3ODIyMjE2NDh8MA&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/Spp1G283dow/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxfHxXcmFwc3xlbnwwfHx8fDE3ODIyMjE2NDh8MA"
  },
  fishFillet: {
    source: "unsplash",
    authorName: "Rodrigo Rodrigues | WOLF Λ R T",
    authorUrl: "https://unsplash.com/de/@wolfart32?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/salmon-fillets-in-green-sauce-in-a-white-dish-Qc0Od6_PM2I?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1756066234411-252edeed6780?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxNnx8RmlzY2hmaWxldHxlbnwwfHx8fDE3ODIyMjE3MTd8MA&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/Qc0Od6_PM2I/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxNnx8RmlzY2hmaWxldHxlbnwwfHx8fDE3ODIyMjE3MTd8MA"
  },
  salmon: {
    source: "unsplash",
    authorName: "Caroline Attwood",
    authorUrl: "https://unsplash.com/de/@_carolineattwood?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/raw-fish-meat-on-brown-chopping-board-kC9KUtSiflw?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1499125562588-29fb8a56b5d5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxfHxMYWNoc3xlbnwwfHx8fDE3ODIyMjE3OTN8MA&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/kC9KUtSiflw/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxfHxMYWNoc3xlbnwwfHx8fDE3ODIyMjE3OTN8MA"
  },
  seafood: {
    source: "unsplash",
    authorName: "Gabriel Gonzalez",
    authorUrl: "https://unsplash.com/de/@etrafoto?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/a-wooden-bowl-filled-with-lots-of-different-types-of-fruit-zLoCrRwxL7Q?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1674947972964-ee9365c40434?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxMnx8TWVlcmVzZnIlQzMlQkNjaHRlfGVufDB8fHx8MTc4MjIxMjEzMXww&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/zLoCrRwxL7Q/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxMnx8TWVlcmVzZnIlQzMlQkNjaHRlfGVufDB8fHx8MTc4MjIxMjEzMXww"
  },
  smokedFish: {
    source: "unsplash",
    authorName: "Viktor Talashuk",
    authorUrl: "https://unsplash.com/de/@viktortalashuk?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/white-smoke-coming-out-from-brown-wood-Zcqw1XnVnDo?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1602410086232-0cdfb78b434f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwzfHxyYXVjaHxlbnwwfHx8fDE3ODIyMjE5MDF8MA&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/Zcqw1XnVnDo/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwzfHxyYXVjaHxlbnwwfHx8fDE3ODIyMjE5MDF8MA"
  },
  tuna: {
    source: "unsplash",
    authorName: "Ray Harrington",
    authorUrl: "https://unsplash.com/de/@raymondo600?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/a-fish-is-jumping-out-of-the-water-aK8dFJswcKE?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1697030891256-36a3770cddde?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxfHxUaHVuZmlzY2h8ZW58MHx8fHwxNzgyMjIxOTI3fDA&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/aK8dFJswcKE/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxfHxUaHVuZmlzY2h8ZW58MHx8fHwxNzgyMjIxOTI3fDA"
  },
  coldCuts: {
    source: "unsplash",
    authorName: "Amy Vann",
    authorUrl: "https://unsplash.com/de/@girl_behindthelens?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/a-wooden-cutting-board-topped-with-different-types-of-meat-TP8PHmUItlg?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1700486338138-5cc21dae205a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHw4fHxXdXJzdCUyMGF1ZnNjaG5pdHR8ZW58MHx8fHwxNzgyMjIxOTg1fDA&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/TP8PHmUItlg/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHw4fHxXdXJzdCUyMGF1ZnNjaG5pdHR8ZW58MHx8fHwxNzgyMjIxOTg1fDA"
  },
  groundMeat: {
    source: "unsplash",
    authorName: "Natalia Gusakova",
    authorUrl: "https://unsplash.com/de/@nataliaraylenegusakova?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/a-board-with-raw-meat-and-a-glass-of-wine-qH-8E2IFqLs?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1668887465701-41fee9e1d474?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxMnx8RmxlaXNjaCUyMGdlaGFja3R8ZW58MHx8fHwxNzgyMjIyMDQwfDA&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/qH-8E2IFqLs/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxMnx8RmxlaXNjaCUyMGdlaGFja3R8ZW58MHx8fHwxNzgyMjIyMDQwfDA"
  },
  chicken: {
    source: "unsplash",
    authorName: "Sahand Babali",
    authorUrl: "https://unsplash.com/de/@sahandbabali?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/red-rooster-in-close-up-photography-E6ng4xuZlxE?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1583510383754-35fc1d1eb598?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxMXx8SHVobnxlbnwwfHx8fDE3ODIyMjIwODB8MA&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/E6ng4xuZlxE/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxMXx8SHVobnxlbnwwfHx8fDE3ODIyMjIwODB8MA"
  },
  beef: {
    source: "unsplash",
    authorName: "Prometheus 🔥",
    authorUrl: "https://unsplash.com/de/@iamateapot?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/a-close-up-of-a-cow-in-a-field-SfAZYBNSPUA?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1682591897995-d50f02038bc9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxM3x8UmluZHxlbnwwfHx8fDE3ODIyMjIxMTV8MA&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/SfAZYBNSPUA/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxM3x8UmluZHxlbnwwfHx8fDE3ODIyMjIxMTV8MA"
  },
  ham: {
    source: "unsplash",
    authorName: "Сергей Орловский",
    authorUrl: "https://unsplash.com/de/@sorel_67?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/sliced-ham-1OfPse1qVLM?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1524438418049-ab2acb7aa48f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxfHxTY2hpbmtlbnxlbnwwfHx8fDE3ODIyMjIxMzl8MA&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/1OfPse1qVLM/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxfHxTY2hpbmtlbnxlbnwwfHx8fDE3ODIyMjIxMzl8MA"
  },
  pork: {
    source: "unsplash",
    authorName: "Laura Anderson",
    authorUrl: "https://unsplash.com/de/@theandersons?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/pig-lies-on-ground-CP9GGy_LkIY?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1567201080580-bfcc97dae346?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHw2fHxTY2h3ZWlufGVufDB8fHx8MTc4MjIyMjE2MHww&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/CP9GGy_LkIY/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHw2fHxTY2h3ZWlufGVufDB8fHx8MTc4MjIyMjE2MHww"
  },
  sausages: {
    source: "unsplash",
    authorName: "Rich Smith",
    authorUrl: "https://unsplash.com/de/@richwilliamsmith?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/sausages-on-grill-15tRu0OgPUk?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1547424450-75ec164925ad?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwyOHx8V3Vyc3R8ZW58MHx8fHwxNzgyMjEyNDAxfDA&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/15tRu0OgPUk/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwyOHx8V3Vyc3R8ZW58MHx8fHwxNzgyMjEyNDAxfDA"
  },
  cereal: {
    source: "unsplash",
    authorName: "𝒮 𝐴 ℛ 𝐴 ✿",
    authorUrl: "https://unsplash.com/de/@saronita?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/a-bowl-of-cornflakes-with-tulips-in-the-background-jqKsYTIhG64?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1744703570045-80cf7c8e69bf?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxMXx8RnIlQzMlQkNoc3QlQzMlQkNja3NmbG9ja2VufGVufDB8fHx8MTc4MjIyMjIxOXww&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/jqKsYTIhG64/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxMXx8RnIlQzMlQkNoc3QlQzMlQkNja3NmbG9ja2VufGVufDB8fHx8MTc4MjIyMjIxOXww"
  },
  honey: {
    source: "unsplash",
    authorName: "Art Rachen",
    authorUrl: "https://unsplash.com/de/@artrachen?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/clear-glass-jar-with-brown-liquid-Asj5DFw8UAw?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1587049352851-8d4e89133924?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxfHxIb25pZ3xlbnwwfHx8fDE3ODIyMjIyNzl8MA&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/Asj5DFw8UAw/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxfHxIb25pZ3xlbnwwfHx8fDE3ODIyMjIyNzl8MA"
  },
  coffee: {
    source: "unsplash",
    authorName: "Wojciech Pacześ",
    authorUrl: "https://unsplash.com/de/@wojtekpaczes?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/a-spoon-full-of-coffee-beans-on-top-of-a-table-OgJYC8q7QSE?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1692296113053-76f240e5ce33?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxOHx8S2FmZmVlYm9obmVufGVufDB8fHx8MTc4MjIyMjMyNXww&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/OgJYC8q7QSE/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxOHx8S2FmZmVlYm9obmVufGVufDB8fHx8MTc4MjIyMjMyNXww"
  },
  jam: {
    source: "unsplash",
    authorName: "Yulia Khlebnikova",
    authorUrl: "https://unsplash.com/de/@khlebnikovayulia?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/clear-glass-jar-with-brown-liquid-o_O75f28GiA?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1590083052217-3c5ca32f3906?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxfHxNYXJtZWxhZGV8ZW58MHx8fHwxNzgyMjIyMzUxfDA&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/o_O75f28GiA/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxfHxNYXJtZWxhZGV8ZW58MHx8fHwxNzgyMjIyMzUxfDA"
  },
  muesli: {
    source: "unsplash",
    authorName: "micheile henderson",
    authorUrl: "https://unsplash.com/de/@micheile?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/brown-wooden-bowl-with-brown-wooden-spoon-bb2cXd5LX6Q?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1614961233913-a5113a4a34ed?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHw2fHxNJUMzJUJDc2xpfGVufDB8fHx8MTc4MjIyMjM3Nnww&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/bb2cXd5LX6Q/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHw2fHxNJUMzJUJDc2xpfGVufDB8fHx8MTc4MjIyMjM3Nnww"
  },
  tea: {
    source: "unsplash",
    authorName: "Nathan Dumlao",
    authorUrl: "https://unsplash.com/de/@nate_dumlao?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/shallow-focus-photography-cup-of-tea-8yBQQqH3q8Q?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1576092768241-dec231879fc3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxN3x8VGVlfGVufDB8fHx8MTc4MjIyMjQwM3ww&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/8yBQQqH3q8Q/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxN3x8VGVlfGVufDB8fHx8MTc4MjIyMjQwM3ww"
  },
  avocados: {
    source: "unsplash",
    authorName: "Eddie Pipocas",
    authorUrl: "https://unsplash.com/de/@eddiepipocas?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/green-and-brown-fruit-on-black-and-brown-fruits-Utnc4nbYFKo?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1612506266679-606568a33215?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxfHxBdm9jYWRvc3xlbnwwfHx8fDE3ODIyMjI1MjF8MA&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/Utnc4nbYFKo/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxfHxBdm9jYWRvc3xlbnwwfHx8fDE3ODIyMjI1MjF8MA"
  },
  broccoli: {
    source: "unsplash",
    authorName: "Annie Spratt",
    authorUrl: "https://unsplash.com/de/@anniespratt?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/green-broccoli-m1t-RJ1iCIU?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1459411621453-7b03977f4bfc?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHw2fHxCcm9ra29saXxlbnwwfHx8fDE3ODIyMjI1NTJ8MA&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/m1t-RJ1iCIU/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHw2fHxCcm9ra29saXxlbnwwfHx8fDE3ODIyMjI1NTJ8MA"
  },
  cucumbers: {
    source: "unsplash",
    authorName: "Harshal S. Hirve",
    authorUrl: "https://unsplash.com/de/@harshalhirve?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/cucumber-lot-2GiRcLP_jkI?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1449300079323-02e209d9d3a6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxfHxHdXJrZW58ZW58MHx8fHwxNzgyMjIyNTk1fDA&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/2GiRcLP_jkI/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxfHxHdXJrZW58ZW58MHx8fHwxNzgyMjIyNTk1fDA"
  },
  carrots: {
    source: "unsplash",
    authorName: "K8",
    authorUrl: "https://unsplash.com/de/@_k8_?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/orange-carrots-on-green-grass-GHRT9j21m2M?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxfHxLYXJvdHRlbnxlbnwwfHx8fDE3ODIyMjI3MDB8MA&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/GHRT9j21m2M/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxfHxLYXJvdHRlbnxlbnwwfHx8fDE3ODIyMjI3MDB8MA"
  },
  potatoes: {
    source: "unsplash",
    authorName: "Lars Blankers",
    authorUrl: "https://unsplash.com/de/@lmablankers?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/brown-potato-lot-B0s3Xndk6tw?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1518977676601-b53f82aba655?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxfHxLYXJ0b2ZmZWxufGVufDB8fHx8MTc4MjIyMjcyOXww&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/B0s3Xndk6tw/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxfHxLYXJ0b2ZmZWxufGVufDB8fHx8MTc4MjIyMjcyOXww"
  },
  garlic: {
    source: "unsplash",
    authorName: "Surya Prakash",
    authorUrl: "https://unsplash.com/de/@surya1213?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/a-couple-of-garlics-sitting-on-top-of-a-table-7aLcC15W59w?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1636210589096-a53d5dacd702?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwyfHxLbm9ibGF1Y2h8ZW58MHx8fHwxNzgyMjIyNzUxfDA&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/7aLcC15W59w/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwyfHxLbm9ibGF1Y2h8ZW58MHx8fHwxNzgyMjIyNzUxfDA"
  },
  peppers: {
    source: "unsplash",
    authorName: "Paul Steuber",
    authorUrl: "https://unsplash.com/de/@paulsteuber?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/a-group-of-red-tomatoes-lLnAm-kQeho?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1657023101749-0e0f82e04e2e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHw3fHxQYXByaWthfGVufDB8fHx8MTc4MjIyMjgwMHww&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/lLnAm-kQeho/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHw3fHxQYXByaWthfGVufDB8fHx8MTc4MjIyMjgwMHww"
  },
  mushrooms: {
    source: "unsplash",
    authorName: "Peter Franke",
    authorUrl: "https://unsplash.com/de/@petfrap?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/a-group-of-mushrooms-sitting-on-top-of-a-lush-green-field-6_eFtUiUJ20?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1642850684903-319199a50759?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxOHx8UGlsemV8ZW58MHx8fHwxNzgyMjIyODI5fDA&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/6_eFtUiUJ20/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxOHx8UGlsemV8ZW58MHx8fHwxNzgyMjIyODI5fDA"
  },
  lettuce: {
    source: "unsplash",
    authorName: "Gabriel Mihalcea",
    authorUrl: "https://unsplash.com/de/@lovelyscape?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/a-head-of-lettuce-on-a-white-background-5MU_4hPl67Y?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1640958904159-51ae08bd3412?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxfHxLb3Bmc2FsYXR8ZW58MHx8fHwxNzgyMjIyODcxfDA&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/5MU_4hPl67Y/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxfHxLb3Bmc2FsYXR8ZW58MHx8fHwxNzgyMjIyODcxfDA"
  },
  tomatoes: {
    source: "unsplash",
    authorName: "engin akyurt",
    authorUrl: "https://unsplash.com/de/@enginakyurt?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/red-tomatoes-on-brown-wooden-table-eb26eV-ys_k?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1582284540020-8acbe03f4924?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxfHxUb21hdGVufGVufDB8fHx8MTc4MjIyMjkwMHww&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/eb26eV-ys_k/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxfHxUb21hdGVufGVufDB8fHx8MTc4MjIyMjkwMHww"
  },
  zucchini: {
    source: "unsplash",
    authorName: "personalgraphic.com",
    authorUrl: "https://unsplash.com/de/@personal_graphic?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/three-green-cucumbers-on-a-white-background-_Ef2SUNv468?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1691480291894-75229c2bfd44?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxfHxadWNjaGluaXxlbnwwfHx8fDE3ODIyMjI5MjJ8MA&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/_Ef2SUNv468/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxfHxadWNjaGluaXxlbnwwfHx8fDE3ODIyMjI5MjJ8MA"
  },
  onions: {
    source: "unsplash",
    authorName: "Mockup Graphics",
    authorUrl: "https://unsplash.com/de/@mockupgraphics?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/3-white-garlic-on-white-background-bC1fXU1v98U?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1587049633312-d628ae50a8ae?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwyfHxad2llYmVsbnxlbnwwfHx8fDE3ODIyMjI5NTR8MA&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/bC1fXU1v98U/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwyfHxad2llYmVsbnxlbnwwfHx8fDE3ODIyMjI5NTR8MA"
  },
  beer: {
    source: "unsplash",
    authorName: "engin akyurt",
    authorUrl: "https://unsplash.com/de/@enginakyurt?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/clear-glass-beer-mug-with-beer-3ORoQEJY9LA?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1608270586620-248524c67de9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwyfHxCaWVyfGVufDB8fHx8MTc4MjIyOTI4N3ww&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/3ORoQEJY9LA/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwyfHxCaWVyfGVufDB8fHx8MTc4MjIyOTI4N3ww"
  },
  softDrinks: {
    source: "unsplash",
    authorName: "Paul Siewert",
    authorUrl: "https://unsplash.com/de/@paul_siewert?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/a-display-case-filled-with-lots-of-drinks-QjFfLfa9qWA?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1613395766428-4328b57f144f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHw5fHxFcmZyaXNjaHVuZ3NnZXRyJUMzJUE0bmtlfGVufDB8fHx8MTc4MjIyOTMzMnww&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/QjFfLfa9qWA/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHw5fHxFcmZyaXNjaHVuZ3NnZXRyJUMzJUE0bmtlfGVufDB8fHx8MTc4MjIyOTMzMnww"
  },
  lemonade: {
    source: "unsplash",
    authorName: "Chris Reyem",
    authorUrl: "https://unsplash.com/de/@chris_reyem?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/a-row-of-empty-bottles-sitting-on-top-of-a-table-EdDy1OsMdM0?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1716497046162-1326a7703f8e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwyNHx8TGltb25hZGV8ZW58MHx8fHwxNzgyMjI5MzY5fDA&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/EdDy1OsMdM0/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwyNHx8TGltb25hZGV8ZW58MHx8fHwxNzgyMjI5MzY5fDA"
  },
  juice: {
    source: "unsplash",
    authorName: "ABHISHEK HAJARE",
    authorUrl: "https://unsplash.com/de/@abhishek_hajare?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/orange-juice-in-clear-drinking-glass-kkrXVKK-jhg?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1600271886742-f049cd451bba?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxfHxTYWZ0fGVufDB8fHx8MTc4MjIyOTQwNXww&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/kkrXVKK-jhg/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxfHxTYWZ0fGVufDB8fHx8MTc4MjIyOTQwNXww"
  },
  water: {
    source: "unsplash",
    authorName: "Grafix Naim",
    authorUrl: "https://unsplash.com/de/@grafixnaim001?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/a-bottle-of-water-sitting-on-top-of-a-wooden-table-mvpn1JCPt9g?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1740905328413-a2d11b9ec7fb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwyOXx8V2Fzc2VyZmxhc2NoZW58ZW58MHx8fHwxNzgyMjI5NDQ4fDA&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/mvpn1JCPt9g/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwyOXx8V2Fzc2VyZmxhc2NoZW58ZW58MHx8fHwxNzgyMjI5NDQ4fDA"
  },
  wine: {
    source: "unsplash",
    authorName: "Klara Kulikova",
    authorUrl: "https://unsplash.com/de/@kkalerry?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/wine-bottles-on-rack-CPMZguYURMw?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1578911373434-0cb395d2cbfb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxMXx8V2VpbnxlbnwwfHx8fDE3ODIyMjk0ODJ8MA&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/CPMZguYURMw/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxMXx8V2VpbnxlbnwwfHx8fDE3ODIyMjk0ODJ8MA"
  },
  spices: {
    source: "unsplash",
    authorName: "Merve Sehirli Nasir",
    authorUrl: "https://unsplash.com/de/@32steps?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/assorted-spices-in-clear-glass-containers-dSbUXPQ8Sm8?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1591272216626-b09e38519371?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHw5fHxHZXclQzMlQkNyemV8ZW58MHx8fHwxNzgyMjEyNjgyfDA&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/dSbUXPQ8Sm8/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHw5fHxHZXclQzMlQkNyemV8ZW58MHx8fHwxNzgyMjEyNjgyfDA"
  },
  ketchup: {
    source: "unsplash",
    authorName: "Pedro Durigan",
    authorUrl: "https://unsplash.com/de/@duriganribeiro?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/1869-heinz-tomato-ketchup-bottle-close-up-photography-b8jHMJOzso8?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1528750596806-ff12e21cda04?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxMHx8S2V0Y2h1cHxlbnwwfHx8fDE3ODIyMjk1NjB8MA&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/b8jHMJOzso8/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxMHx8S2V0Y2h1cHxlbnwwfHx8fDE3ODIyMjk1NjB8MA"
  },
  herbs: {
    source: "unsplash",
    authorName: "Kevin Doran",
    authorUrl: "https://unsplash.com/de/@kfitzdor?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/green-plant-on-brown-wooden-table-OtdNWHGRvfI?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1604543631489-4c03c8cc6ded?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxMXx8S3IlQzMlQTR1dGVyfGVufDB8fHx8MTc4MjIyOTYwMXww&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/OtdNWHGRvfI/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxMXx8S3IlQzMlQTR1dGVyfGVufDB8fHx8MTc4MjIyOTYwMXww"
  },
  mayonnaise: {
    source: "unsplash",
    authorName: "Kelsey Todd",
    authorUrl: "https://unsplash.com/de/@sparkledump?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/a-hand-holding-a-white-container-No08yCz6Ejs?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1662523978710-1666ee98c9f6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwzfHxNYXlvbm5haXNlfGVufDB8fHx8MTc4MjIyOTYzNnww&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/No08yCz6Ejs/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwzfHxNYXlvbm5haXNlfGVufDB8fHx8MTc4MjIyOTYzNnww"
  },
  pepper: {
    source: "unsplash",
    authorName: "Maria Kovalets",
    authorUrl: "https://unsplash.com/de/@marylooo?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/a-wooden-spoon-filled-with-raisins-on-top-of-a-wooden-table-3FBp7qOkexg?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1737099100126-5200ed2ba5a5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxMnx8UGZlZmZlcnxlbnwwfHx8fDE3ODIyMzE2NTd8MA&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/3FBp7qOkexg/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxMnx8UGZlZmZlcnxlbnwwfHx8fDE3ODIyMzE2NTd8MA"
  },
  mustard: {
    source: "unsplash",
    authorName: "Addilyn Ragsdill @clockworklemon.com",
    authorUrl: "https://unsplash.com/de/@clockwork_lemon?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/a-bottle-of-mustard-sitting-on-top-of-a-wooden-table-v4faGoQKvEg?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1638324396220-432156cd9303?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxOHx8TXVzdGFyZHxlbnwwfHx8fDE3ODIyMzE2OTl8MA&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/v4faGoQKvEg/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxOHx8TXVzdGFyZHxlbnwwfHx8fDE3ODIyMzE2OTl8MA"
  },
  tomatoSauce: {
    source: "unsplash",
    authorName: "Anna Blake",
    authorUrl: "https://unsplash.com/de/@blake_a?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/tomato-juice-bottle-with-fresh-tomatoes-and-herbs-0pYv7LOetxA?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1741594822867-0d849faff7e3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwyMnx8VG9tYXRlbiUyMHNvJUMzJTlGZXxlbnwwfHx8fDE3ODIyMzE3MzN8MA&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/0pYv7LOetxA/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwyMnx8VG9tYXRlbiUyMHNvJUMzJTlGZXxlbnwwfHx8fDE3ODIyMzE3MzN8MA"
  },
  aluminumFoil: {
    source: "unsplash",
    authorName: "Bernd 📷 Dittrich",
    authorUrl: "https://unsplash.com/de/@hdbernd?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/cooked-crawfish-covered-with-aluminum-foil-YJjMFOBnKis?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1757787550481-dbc279547d6a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxOXx8QWx1bWludW0lMjBmb2lsfGVufDB8fHx8MTc4MjIzMTgyNHww&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/YJjMFOBnKis/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxOXx8QWx1bWludW0lMjBmb2lsfGVufDB8fHx8MTc4MjIzMTgyNHww"
  },
  bakingPaper: {
    source: "unsplash",
    authorName: "Ivan Gromov",
    authorUrl: "https://unsplash.com/de/@creativesuppliesco?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/creased-brown-kraft-paper-texture-Y3vPEuNlf7w?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1519972064555-542444e71b54?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxfHxCYWtpbmclMjBwYXBlcnxlbnwwfHx8fDE3ODIyMzE4NTd8MA&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/Y3vPEuNlf7w/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxfHxCYWtpbmclMjBwYXBlcnxlbnwwfHx8fDE3ODIyMzE4NTd8MA"
  },
  kitchenRoll: {
    source: "unsplash",
    authorName: "Brandon Cormier",
    authorUrl: "https://unsplash.com/de/@brandoncormier?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/a-kitchen-counter-with-a-cutting-board-and-knife-holder-OzwR9wlCV8w?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1632334994199-cc2ba6538141?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwyfHxQYXBlciUyMHRvd2Vsc3xlbnwwfHx8fDE3ODIyMzE5MDR8MA&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/OzwR9wlCV8w/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwyfHxQYXBlciUyMHRvd2Vsc3xlbnwwfHx8fDE3ODIyMzE5MDR8MA"
  },
  trashBags: {
    source: "unsplash",
    authorName: "Phuong Nguyen",
    authorUrl: "https://unsplash.com/de/@phuongtography?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/plastic-bag-filled-with-discarded-food-waste-8l-pLUHM_4U?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1763741211088-f2adcaf84e0e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxNnx8VHJhc2glMjBiYWdzfGVufDB8fHx8MTc4MjIzMTk0NXww&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/8l-pLUHM_4U/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxNnx8VHJhc2glMjBiYWdzfGVufDB8fHx8MTc4MjIzMTk0NXww"
  },
  dishSoap: {
    source: "unsplash",
    authorName: "Sixteen Miles Out",
    authorUrl: "https://unsplash.com/de/@sixteenmilesout?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/person-holding-white-plastic-pump-bottle-BlLh0xjlJCw?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1590610994353-7b0e7546e681?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxfHxEaXNoJTIwc29hcHxlbnwwfHx8fDE3ODIyMzE5OTR8MA&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/BlLh0xjlJCw/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxfHxEaXNoJTIwc29hcHxlbnwwfHx8fDE3ODIyMzE5OTR8MA"
  },
  toiletPaper: {
    source: "unsplash",
    authorName: "Erik Mclean",
    authorUrl: "https://unsplash.com/de/@introspectivedsgn?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/white-toilet-paper-roll-on-brown-wooden-table-GNHkPsONmac?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1584556812945-a6830379555b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHw2fHxUb2lsZXQlMjBwYXBlcnxlbnwwfHx8fDE3ODIyMzIwNTJ8MA&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/GNHkPsONmac/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHw2fHxUb2lsZXQlMjBwYXBlcnxlbnwwfHx8fDE3ODIyMzIwNTJ8MA"
  },
  beans: {
    source: "unsplash",
    authorName: "Brett Jordan",
    authorUrl: "https://unsplash.com/de/@brett_jordan?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/two-cans-of-heinz-baked-beans-on-a-shelf-WqnNG6GVHfY?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1767214223592-f8d280efa7cf?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxNHx8Q2FubmVkJTIwYmVhbnN8ZW58MHx8fHwxNzgyMjMyMTI4fDA&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/WqnNG6GVHfY/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxNHx8Q2FubmVkJTIwYmVhbnN8ZW58MHx8fHwxNzgyMjMyMTI4fDA"
  },
  cannedTomatoes: {
    source: "unsplash",
    authorName: "Girl with red hat",
    authorUrl: "https://unsplash.com/de/@girlwithredhat?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/campbells-chicken-noodle-soup-can-C0MAGd-6aZM?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1615589484252-c70def71bb4f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxOXx8Q2FubmVkJTIwdG9tYXRvc3xlbnwwfHx8fDE3ODIyMzIxNTd8MA&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/C0MAGd-6aZM/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxOXx8Q2FubmVkJTIwdG9tYXRvc3xlbnwwfHx8fDE3ODIyMzIxNTd8MA"
  },
  chickpeas: {
    source: "unsplash",
    authorName: "Deryn Macey",
    authorUrl: "https://unsplash.com/de/@runningonrealfood?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/yellow-corn-on-glass-bowl-h83Rm3njjcg?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1515543904379-3d757afe72e4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxOHx8Q2FubmVkJTIwY2hpY2twZWFzfGVufDB8fHx8MTc4MjIzMjIwNnww&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/h83Rm3njjcg/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxOHx8Q2FubmVkJTIwY2hpY2twZWFzfGVufDB8fHx8MTc4MjIzMjIwNnww"
  },
  coconutMilk: {
    source: "unsplash",
    authorName: "Tijana Drndarski",
    authorUrl: "https://unsplash.com/de/@izgubljenausvemiru?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/white-round-cake-with-white-cream-on-brown-wooden-round-tray-BNZrKnocA3c?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1588413336019-dd5d3beddf55?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwyfHxjYW5uZWQlMjBjb2NvbnV0JTIwbWlsa3xlbnwwfHx8fDE3ODIyMzIyNDZ8MA&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/BNZrKnocA3c/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwyfHxjYW5uZWQlMjBjb2NvbnV0JTIwbWlsa3xlbnwwfHx8fDE3ODIyMzIyNDZ8MA"
  },
  cannedCorn: {
    source: "unsplash",
    authorName: "thiago japyassu",
    authorUrl: "https://unsplash.com/de/@thiagojapyassu?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/a-plate-of-corn-hnCVs9SZBx4?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1656628678780-fa0c78b52f33?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHw2fHxDYW5uZWQlMjBjb3JufGVufDB8fHx8MTc4MjIzMjI5NHww&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/hnCVs9SZBx4/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHw2fHxDYW5uZWQlMjBjb3JufGVufDB8fHx8MTc4MjIzMjI5NHww"
  },
  soups: {
    source: "unsplash",
    authorName: "Joshua Olsen",
    authorUrl: "https://unsplash.com/de/@photowolf?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/red-and-white-labeled-cans-4idxKku2hJw?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1619995746608-bef3de4f075a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwyOHx8Y2FubmVkJTIwc291cGV8ZW58MHx8fHwxNzgyMjMyMzI0fDA&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/4idxKku2hJw/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwyOHx8Y2FubmVkJTIwc291cGV8ZW58MHx8fHwxNzgyMjMyMzI0fDA"
  },
  butter: {
    source: "unsplash",
    authorName: "Sorin Gheorghita",
    authorUrl: "https://unsplash.com/de/@sxtcxtc?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/sliced-cheese-on-clear-glass-plate-094mP_CBdpM?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxfHxCdXR0ZXJ8ZW58MHx8fHwxNzgyMjMyMzYzfDA&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/094mP_CBdpM/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxfHxCdXR0ZXJ8ZW58MHx8fHwxNzgyMjMyMzYzfDA"
  },
  eggs: {
    source: "unsplash",
    authorName: "Rachael Gorjestani",
    authorUrl: "https://unsplash.com/de/@rachaelgorjestani?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/five-broil-eggs-g8xdO1Q1kIg?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1477506410535-f12fe9af97cc?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHw5fHxFaWVyfGVufDB8fHx8MTc4MjIzMjM5OXww&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/g8xdO1Q1kIg/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHw5fHxFaWVyfGVufDB8fHx8MTc4MjIzMjM5OXww"
  },
  creamCheese: {
    source: "unsplash",
    authorName: "Fahmi Huwaidy",
    authorUrl: "https://unsplash.com/de/@fahmihuwaidy_?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/a-display-case-in-a-store-filled-with-lots-of-food-Oyn7BjgyFjE?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1719427129158-31b6d19c400b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxOXx8RnJpc2NoayVDMyVBNHNlfGVufDB8fHx8MTc4MjIzMjQyN3ww&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/Oyn7BjgyFjE/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxOXx8RnJpc2NoayVDMyVBNHNlfGVufDB8fHx8MTc4MjIzMjQyN3ww"
  },
  yogurt: {
    source: "unsplash",
    authorName: "Bennet",
    authorUrl: "https://unsplash.com/de/@b_schulze?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/a-table-topped-with-desserts-on-top-of-a-metal-tray-D6z7hWlFUUI?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1721766312772-11a51fa1afa8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxM3x8Sm9naHVydHxlbnwwfHx8fDE3ODIyMTI4NDN8MA&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/D6z7hWlFUUI/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxM3x8Sm9naHVydHxlbnwwfHx8fDE3ODIyMTI4NDN8MA"
  },
  cheese: {
    source: "unsplash",
    authorName: "David Foodphototasty",
    authorUrl: "https://unsplash.com/de/@phototastyfood?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/a-couple-of-pieces-of-cheese-sitting-on-top-of-a-wooden-cutting-board-JJcT6VJWDlg?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1683314573422-649a3c6ad784?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxfHxLJUMzJUE0c2V8ZW58MHx8fHwxNzgyMjMyNDkxfDA&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/JJcT6VJWDlg/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxfHxLJUMzJUE0c2V8ZW58MHx8fHwxNzgyMjMyNDkxfDA"
  },
  milk: {
    source: "unsplash",
    authorName: "Mary Skrynnikova 💛💙",
    authorUrl: "https://unsplash.com/de/@mary_skr?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/a-bottle-of-milk-next-to-a-glass-of-milk-c6TKtsi8C1k?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1639151082235-406d8eb262b9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHw5fHxNaWxjaHxlbnwwfHx8fDE3ODIyMzI1MTR8MA&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/c6TKtsi8C1k/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHw5fHxNaWxjaHxlbnwwfHx8fDE3ODIyMzI1MTR8MA"
  },
  quark: {
    source: "unsplash",
    authorName: "Daniel Cabriles",
    authorUrl: "https://unsplash.com/de/@danielcabriles?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/ice-cream-with-sliced-lemon-on-white-ceramic-plate-Xboa6hvS_5Q?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1593198232414-72431a1cc506?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxM3x8ZnJ1aXQlMjBRdWFya3xlbnwwfHx8fDE3ODIyMzI1Njl8MA&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/Xboa6hvS_5Q/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxM3x8ZnJ1aXQlMjBRdWFya3xlbnwwfHx8fDE3ODIyMzI1Njl8MA"
  },
  cream: {
    source: "unsplash",
    authorName: "Daniela Chavez",
    authorUrl: "https://unsplash.com/de/@dani8808?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/white-paper-flower-petals-on-white-surface-hArjLHA1yMw?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1622737338437-39a24c37f0de?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxfHxTYWhuZXxlbnwwfHx8fDE3ODIyMzI2MDF8MA&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/hArjLHA1yMw/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxfHxTYWhuZXxlbnwwfHx8fDE3ODIyMzI2MDF8MA"
  },
  sourCream: {
    source: "unsplash",
    authorName: "Karolina Kołodziejczak",
    authorUrl: "https://unsplash.com/de/@rabbit_in_blue?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/clear-glass-bowl-with-white-cream-rhexgeqEBu8?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1605883709265-3cc8ca6b3a3c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwyfHxzb3VyJTIwY3JlYW18ZW58MHx8fHwxNzgyMjMyNjM5fDA&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/rhexgeqEBu8/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwyfHxzb3VyJTIwY3JlYW18ZW58MHx8fHwxNzgyMjMyNjM5fDA"
  },
  apples: {
    source: "unsplash",
    authorName: "James Yarema",
    authorUrl: "https://unsplash.com/de/@jamesyarema?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/green-and-red-apples-on-white-plastic-container-P2X7NDx_GP0?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1610397962076-02407a169a5b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHw2fHwlQzMlODRwZmVsfGVufDB8fHx8MTc4MjIzMjY3OHww&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/P2X7NDx_GP0/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHw2fHwlQzMlODRwZmVsfGVufDB8fHx8MTc4MjIzMjY3OHww"
  },
  bananas: {
    source: "unsplash",
    authorName: "Rodrigo dos Reis",
    authorUrl: "https://unsplash.com/de/@rodreis?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/yellow-banana-fruit-on-brown-wooden-table-DkTuGvgPotA?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1603833665858-e61d17a86224?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwyfHxCYW5hbmVufGVufDB8fHx8MTc4MjIzMjY5N3ww&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/DkTuGvgPotA/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwyfHxCYW5hbmVufGVufDB8fHx8MTc4MjIzMjY5N3ww"
  },
  berries: {
    source: "unsplash",
    authorName: "Adél Grőber",
    authorUrl: "https://unsplash.com/de/@ninszi?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/strawberries-on-white-ceramic-bowl-LHLPeIGVUBw?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1613082410785-22292e8426e7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwzfHxCZWVyZW58ZW58MHx8fHwxNzgyMjMyNzM0fDA&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/LHLPeIGVUBw/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwzfHxCZWVyZW58ZW58MHx8fHwxNzgyMjMyNzM0fDA"
  },
  pears: {
    source: "unsplash",
    authorName: "Lovelli Fuad",
    authorUrl: "https://unsplash.com/de/@lovellifuad?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/green-and-red-apples-and-apples-5lrbbXC_kxA?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1631160299919-6a175aa6d189?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxfHxCaXJuZW58ZW58MHx8fHwxNzgyMjMyNzYzfDA&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/5lrbbXC_kxA/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxfHxCaXJuZW58ZW58MHx8fHwxNzgyMjMyNzYzfDA"
  },
  kiwis: {
    source: "unsplash",
    authorName: "MARIOLA GROBELSKA",
    authorUrl: "https://unsplash.com/de/@mariolagr?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/a-group-of-kiwis-wwgEXC3Q4d0?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1662286646673-1ef6d6fdf4dd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxOHx8S2l3aXN8ZW58MHx8fHwxNzgyMjMyNzkwfDA&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/wwgEXC3Q4d0/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxOHx8S2l3aXN8ZW58MHx8fHwxNzgyMjMyNzkwfDA"
  },
  oranges: {
    source: "unsplash",
    authorName: "Jen Gunter",
    authorUrl: "https://unsplash.com/de/@sweetsimplesunshine?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/orange-fruits-on-white-ceramic-plate-A4BBdJQu2co?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1611080626919-7cf5a9dbab5b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxfHxPcmFuZ2VufGVufDB8fHx8MTc4MjIzMjgyMXww&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/A4BBdJQu2co/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxfHxPcmFuZ2VufGVufDB8fHx8MTc4MjIzMjgyMXww"
  },
  grapes: {
    source: "unsplash",
    authorName: "MARIOLA GROBELSKA",
    authorUrl: "https://unsplash.com/de/@mariolagr?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/a-pile-of-green-grapes--aEfs2OUBtU?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1662150681381-b771ab6fb42a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxMHx8V2VpbnRyYXViZW58ZW58MHx8fHwxNzgyMjMyODQ0fDA&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/-aEfs2OUBtU/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxMHx8V2VpbnRyYXViZW58ZW58MHx8fHwxNzgyMjMyODQ0fDA"
  },
  lemons: {
    source: "unsplash",
    authorName: "Thitiphum Koonjantuek",
    authorUrl: "https://unsplash.com/de/@phumthiti?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/yellow-citrus-fruits-on-black-surface-TFqjlTmkeyY?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1590502593747-42a996133562?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxfHxaaXRyb25lbnxlbnwwfHx8fDE3ODIyMzI4NzN8MA&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/TFqjlTmkeyY/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxfHxaaXRyb25lbnxlbnwwfHx8fDE3ODIyMzI4NzN8MA"
  },
  chips: {
    source: "unsplash",
    authorName: "Mustafa Bashari",
    authorUrl: "https://unsplash.com/de/@mustafabashari?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/brown-chips-on-brown-textile-S4PC4SeKwKg?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1613919113640-25732ec5e61f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxfHxDaGlwc3xlbnwwfHx8fDE3ODIyMzI5MDl8MA&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/S4PC4SeKwKg/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxfHxDaGlwc3xlbnwwfHx8fDE3ODIyMzI5MDl8MA"
  },
  gummyCandy: {
    source: "unsplash",
    authorName: "Alexas_Fotos",
    authorUrl: "https://unsplash.com/de/@alexas_fotos?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/red-and-yellow-heart-shaped-decors-dkUGwsnTKwA?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1606005600469-f012fe104a4d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxfHxGcnVjaHRndW1taXxlbnwwfHx8fDE3ODIyMzI5MzF8MA&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/dkUGwsnTKwA/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxfHxGcnVjaHRndW1taXxlbnwwfHx8fDE3ODIyMzI5MzF8MA"
  },
  biscuits: {
    source: "unsplash",
    authorName: "Julissa Capdevilla",
    authorUrl: "https://unsplash.com/de/@juliedroz?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/brown-cookies-on-white-surface-tDoHiqXl9b8?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1598839950984-034f6dc7b495?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwyfHxLZWtzZXxlbnwwfHx8fDE3ODIyMzI5NTZ8MA&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/tDoHiqXl9b8/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwyfHxLZWtzZXxlbnwwfHx8fDE3ODIyMzI5NTZ8MA"
  },
  nuts: {
    source: "unsplash",
    authorName: "Raspopova Marina",
    authorUrl: "https://unsplash.com/de/@raspopovamarisha?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/brown-round-fruit-in-brown-wicker-basket-Kd6uDjOVwDE?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1600189083288-89e1c8b9b0cc?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxMXx8TiVDMyVCQ3NzZXxlbnwwfHx8fDE3ODIyMzI5Nzl8MA&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/Kd6uDjOVwDE/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxMXx8TiVDMyVCQ3NzZXxlbnwwfHx8fDE3ODIyMzI5Nzl8MA"
  },
  popcorn: {
    source: "unsplash",
    authorName: "Doha Khattab",
    authorUrl: "https://unsplash.com/de/@dnk0?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/white-popcorn-in-close-up-photography-71Gat3EdosY?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1625687361215-d87365beca3b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwyMnx8UG9wY29ybnxlbnwwfHx8fDE3ODIyMzMwMTB8MA&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/71Gat3EdosY/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwyMnx8UG9wY29ybnxlbnwwfHx8fDE3ODIyMzMwMTB8MA"
  },
  chocolate: {
    source: "unsplash",
    authorName: "Tetiana Bykovets",
    authorUrl: "https://unsplash.com/de/@tetiana_bykovets?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/chocolate-bars-on-white-table-H22N-9s8AUw?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1610450949065-1f2841536c88?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwyfHxTY2hva29sYWRlfGVufDB8fHx8MTc4MjIzMzAzMnww&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/H22N-9s8AUw/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwyfHxTY2hva29sYWRlfGVufDB8fHx8MTc4MjIzMzAzMnww"
  },
  iceCream: {
    source: "unsplash",
    authorName: "Lama Roscu",
    authorUrl: "https://unsplash.com/de/@lamaroscu?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/variety-of-ice-creams-Wpg3Qm0zaGk?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1567206563064-6f60f40a2b57?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxOXx8U3BlaXNlZWlzfGVufDB8fHx8MTc4MjIzMzA3NHww&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/Wpg3Qm0zaGk/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxOXx8U3BlaXNlZWlzfGVufDB8fHx8MTc4MjIzMzA3NHww"
  },
  readyMeals: {
    source: "unsplash",
    authorName: "Caglar Araz",
    authorUrl: "https://unsplash.com/de/@caglararaz?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/pasta-with-herbs-BCyWsAOWDo8?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1573742116698-f5b4aa226c5c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHw5fHxGZXJ0aWdnZXJpY2h0ZXxlbnwwfHx8fDE3ODIyMzMwOTl8MA&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/BCyWsAOWDo8/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHw5fHxGZXJ0aWdnZXJpY2h0ZXxlbnwwfHx8fDE3ODIyMzMwOTl8MA"
  },
  fishSticks: {
    source: "unsplash",
    authorName: "Haseeb Modi",
    authorUrl: "https://unsplash.com/de/@haseebm?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/a-white-plate-topped-with-french-fries-and-other-foods-9fUCAqck4Zs?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1678969406337-1869bb0c0dc4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxfHxGaXNoJTIwZmluZ2Vyc3xlbnwwfHx8fDE3ODIyMzMxNDN8MA&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/9fUCAqck4Zs/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxfHxGaXNoJTIwZmluZ2Vyc3xlbnwwfHx8fDE3ODIyMzMxNDN8MA"
  },
  pizza: {
    source: "unsplash",
    authorName: "Alan Hardman",
    authorUrl: "https://unsplash.com/de/@alanaktion?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/pepperoni-pizza-SU1LFoeEUkk?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHw2fHxwaXp6YXxlbnwwfHx8fDE3ODIyMzMxNjl8MA&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/SU1LFoeEUkk/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHw2fHxwaXp6YXxlbnwwfHx8fDE3ODIyMzMxNjl8MA"
  },
  frozenVegetables: {
    source: "unsplash",
    authorName: "Tim Robinson",
    authorUrl: "https://unsplash.com/de/@timothyjrobinson?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/sliced-carrots-and-green-vegetable-qPrwjOQbQJA?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1585935033237-4e38474b2d83?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxNnx8RnJvemVuJTIwdmVnZXRhYmxlc3xlbnwwfHx8fDE3ODIyMzMyMDB8MA&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/qPrwjOQbQJA/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxNnx8RnJvemVuJTIwdmVnZXRhYmxlc3xlbnwwfHx8fDE3ODIyMzMyMDB8MA"
  },
  frozenFruit: {
    source: "unsplash",
    authorName: "Sneha Cecil",
    authorUrl: "https://unsplash.com/de/@sneha_snaps?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/red-and-black-berries-on-black-surface-Qt6ojt3CacE?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1596591606975-97ee5cef3a1e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxfHxGcm96ZW4lMjBmcnVpdHxlbnwwfHx8fDE3ODIyMzMyMjh8MA&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/Qt6ojt3CacE/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxfHxGcm96ZW4lMjBmcnVpdHxlbnwwfHx8fDE3ODIyMzMyMjh8MA"
  },
  vinegar: {
    source: "unsplash",
    authorName: "Towfiqu barbhuiya",
    authorUrl: "https://unsplash.com/de/@towfiqu999999?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/clear-glass-bottle-with-red-liquid-beside-sliced-lemon-on-blue-textile-qxApfY4fGG4?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1628268909461-ec1eec52a74e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxfHxFc3NpZ3xlbnwwfHx8fDE3ODIyMzMyNTd8MA&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/qxApfY4fGG4/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxfHxFc3NpZ3xlbnwwfHx8fDE3ODIyMzMyNTd8MA"
  },
  flour: {
    source: "unsplash",
    authorName: "Jasmin Ne",
    authorUrl: "https://unsplash.com/de/@jasminnb?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/a-wooden-bowl-filled-with-white-powder-next-to-a-bottle-of-honey--STVybdfXvE?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1641301553499-9a0ff924fcb5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxMXx8TWVobHxlbnwwfHx8fDE3ODIyMzMyNzh8MA&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/-STVybdfXvE/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxMXx8TWVobHxlbnwwfHx8fDE3ODIyMzMyNzh8MA"
  },
  pasta: {
    source: "unsplash",
    authorName: "Bozhin Karaivanov",
    authorUrl: "https://unsplash.com/de/@bkaraivanov?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/yellow-flower-petals-in-close-up-photography-m5Ft3bsalhQ?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1598720290281-9f26ae6d6f81?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxOHx8TnVkZWxufGVufDB8fHx8MTc4MjIzMzMwNnww&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/m5Ft3bsalhQ/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxOHx8TnVkZWxufGVufDB8fHx8MTc4MjIzMzMwNnww"
  },
  rice: {
    source: "unsplash",
    authorName: "Pille R. Priske",
    authorUrl: "https://unsplash.com/de/@pillepriske?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/rice-in-bowl-xmuIgjuQG0M?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwyfHxSZWlzfGVufDB8fHx8MTc4MjIzMzMzM3ww&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/xmuIgjuQG0M/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwyfHxSZWlzfGVufDB8fHx8MTc4MjIzMzMzM3ww"
  },
  salt: {
    source: "unsplash",
    authorName: "Faran Raufi",
    authorUrl: "https://unsplash.com/de/@faran_raufi?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/a-wooden-bowl-filled-with-sugar-on-top-of-a-wooden-table-u_Mwofs_zu0?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1634612831148-03a8550e1d52?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwyfHxTYWx6fGVufDB8fHx8MTc4MjIzMzM2Mnww&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/u_Mwofs_zu0/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwyfHxTYWx6fGVufDB8fHx8MTc4MjIzMzM2Mnww"
  },
  cookingOil: {
    source: "unsplash",
    authorName: "jonathan ocampo",
    authorUrl: "https://unsplash.com/de/@johnophoto?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/oil-dispenser-bottle-iCgfwfqgdzo?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1552592074-ea7a91b851b3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHw2fHxDb29raW5nJTIwb2lsfGVufDB8fHx8MTc4MjIzMzQwOXww&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/iCgfwfqgdzo/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHw2fHxDb29raW5nJTIwb2lsfGVufDB8fHx8MTc4MjIzMzQwOXww"
  },
  sugar: {
    source: "unsplash",
    authorName: "Zhang liven",
    authorUrl: "https://unsplash.com/de/@lvenfoto?utm_source=messagedrop&utm_medium=referral",
    unsplashUrl: "https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/a-pile-of-marshmallows-sitting-on-top-of-a-table-tP8_HRehSfE?utm_source=messagedrop&utm_medium=referral",
    imageUrl: "https://images.unsplash.com/photo-1671846534165-dc2e8bf8de87?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHw5fHxadWNrZXJ8ZW58MHx8fHwxNzgyMjMzNDcxfDA&ixlib=rb-4.1.0&q=80&w=1080",
    downloadLocation: "https://api.unsplash.com/photos/tP8_HRehSfE/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHw5fHxadWNrZXJ8ZW58MHx8fHwxNzgyMjMzNDcxfDA"
  }
};

const drugstoreCategoryImage = (id: string): AvatarAttribution | undefined => DRUGSTORE_CATEGORY_IMAGES[id];
const drugstoreProductImage = (id: string): AvatarAttribution | undefined => DRUGSTORE_PRODUCT_IMAGES[id];
const drugstoreProduct = (id: string, unit: ShoppingUnit = 'package', quantity = 1): ShoppingProductTemplate =>
  product(id, unit, quantity, drugstoreProductImage(id));

const DRUGSTORE_CATEGORY_IMAGES: Record<string, AvatarAttribution> = {
  babyCare: {
    source: 'unsplash',
    authorName: 'Jill Sauve',
    authorUrl: 'https://unsplash.com/de/@jillsauve?utm_source=messagedrop&utm_medium=referral',
    unsplashUrl: 'https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral',
    photoUrl: 'https://unsplash.com/photos/person-holding-babys-hand-CSlt2wHuNIk?utm_source=messagedrop&utm_medium=referral',
    imageUrl: 'https://images.unsplash.com/photo-1596252732610-fce5ac542f8e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwyNnx8QmFieXxlbnwwfHx8fDE3ODIyMTQyOTd8MA&ixlib=rb-4.1.0&q=80&w=1080',
    downloadLocation: 'https://api.unsplash.com/photos/CSlt2wHuNIk/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwyNnx8QmFieXxlbnwwfHx8fDE3ODIyMTQyOTd8MA'
  },
  facialCare: {
    source: 'unsplash',
    authorName: 'Eveling Salazar',
    authorUrl: 'https://unsplash.com/de/@eve__3d?utm_source=messagedrop&utm_medium=referral',
    unsplashUrl: 'https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral',
    photoUrl: 'https://unsplash.com/photos/a-jar-of-white-cream-floats-above-a-rock-01YhA5XDDLk?utm_source=messagedrop&utm_medium=referral',
    imageUrl: 'https://images.unsplash.com/photo-1763503839418-2b45c3d7a3c3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxOXx8R2VzaWNodHNjcmVtZXxlbnwwfHx8fDE3ODIyMTQzNTF8MA&ixlib=rb-4.1.0&q=80&w=1080',
    downloadLocation: 'https://api.unsplash.com/photos/01YhA5XDDLk/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxOXx8R2VzaWNodHNjcmVtZXxlbnwwfHx8fDE3ODIyMTQzNTF8MA'
  },
  hairCare: {
    source: 'unsplash',
    authorName: 'Taitopia Render',
    authorUrl: 'https://unsplash.com/de/@taitopiarender?utm_source=messagedrop&utm_medium=referral',
    unsplashUrl: 'https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral',
    photoUrl: 'https://unsplash.com/photos/a-bottle-of-taco-gran-on-top-of-a-rock-xi3gNXQuiu0?utm_source=messagedrop&utm_medium=referral',
    imageUrl: 'https://images.unsplash.com/photo-1700709678003-01941f72fb92?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHw4fHxTaGFtcG9vfGVufDB8fHx8MTc4MjIxNDM4NHww&ixlib=rb-4.1.0&q=80&w=1080',
    downloadLocation: 'https://api.unsplash.com/photos/xi3gNXQuiu0/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHw4fHxTaGFtcG9vfGVufDB8fHx8MTc4MjIxNDM4NHww'
  },
  personalHygiene: {
    source: 'unsplash',
    authorName: 'Fahmi Huwaidy',
    authorUrl: 'https://unsplash.com/de/@fahmihuwaidy_?utm_source=messagedrop&utm_medium=referral',
    unsplashUrl: 'https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral',
    photoUrl: 'https://unsplash.com/photos/a-store-filled-with-lots-of-different-types-of-towels-j5RHT6j-yBY?utm_source=messagedrop&utm_medium=referral',
    imageUrl: 'https://images.unsplash.com/photo-1719427130796-bbcdf9f093fb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHw0fHxEYW1lbmh5Z2llbmV8ZW58MHx8fHwxNzgyMjE0NDY2fDA&ixlib=rb-4.1.0&q=80&w=1080',
    downloadLocation: 'https://api.unsplash.com/photos/j5RHT6j-yBY/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHw0fHxEYW1lbmh5Z2llbmV8ZW58MHx8fHwxNzgyMjE0NDY2fDA'
  },
  bodyCare: {
    source: 'unsplash',
    authorName: 'PLANTADEA',
    authorUrl: 'https://unsplash.com/de/@plantadea?utm_source=messagedrop&utm_medium=referral',
    unsplashUrl: 'https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral',
    photoUrl: 'https://unsplash.com/photos/a-bottle-of-cleanser-sitting-on-top-of-a-table-Os-uMjAI8KQ?utm_source=messagedrop&utm_medium=referral',
    imageUrl: 'https://images.unsplash.com/photo-1691162224581-33f8563f6b15?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwyMnx8U2hvd2VyZ2VsfGVufDB8fHx8MTc4MjIxNDUxOXww&ixlib=rb-4.1.0&q=80&w=1080',
    downloadLocation: 'https://api.unsplash.com/photos/Os-uMjAI8KQ/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwyMnx8U2hvd2VyZ2VsfGVufDB8fHx8MTc4MjIxNDUxOXww'
  },
  paperGoods: {
    source: 'unsplash',
    authorName: '2H Media',
    authorUrl: 'https://unsplash.com/de/@2hmedia?utm_source=messagedrop&utm_medium=referral',
    unsplashUrl: 'https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral',
    photoUrl: 'https://unsplash.com/photos/a-few-pens-on-a-white-surface-uNzsvDXXQQQ?utm_source=messagedrop&utm_medium=referral',
    imageUrl: 'https://images.unsplash.com/photo-1656941599882-808d7b04b86a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxNHx8UGVucyUyMGFuZCUyMHBhcGVyfGVufDB8fHx8MTc4MjIxNDU4Nnww&ixlib=rb-4.1.0&q=80&w=1080',
    downloadLocation: 'https://api.unsplash.com/photos/uNzsvDXXQQQ/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxNHx8UGVucyUyMGFuZCUyMHBhcGVyfGVufDB8fHx8MTc4MjIxNDU4Nnww'
  },
  cleaning: {
    source: 'unsplash',
    authorName: 'Crystal Chabot',
    authorUrl: 'https://unsplash.com/de/@cchabot?utm_source=messagedrop&utm_medium=referral',
    unsplashUrl: 'https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral',
    photoUrl: 'https://unsplash.com/photos/clear-spray-bottle-9gzU1mtTzWM?utm_source=messagedrop&utm_medium=referral',
    imageUrl: 'https://images.unsplash.com/photo-1550963295-019d8a8a61c5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxOXx8UmVpbmlndW5nfGVufDB8fHx8MTc4MjIxNDYzOXww&ixlib=rb-4.1.0&q=80&w=1080',
    downloadLocation: 'https://api.unsplash.com/photos/9gzU1mtTzWM/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxOXx8UmVpbmlndW5nfGVufDB8fHx8MTc4MjIxNDYzOXww'
  },
  laundry: {
    source: 'unsplash',
    authorName: 'daniele baldassarre',
    authorUrl: 'https://unsplash.com/de/@baldaniele?utm_source=messagedrop&utm_medium=referral',
    unsplashUrl: 'https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral',
    photoUrl: 'https://unsplash.com/photos/assorted-color-towels-n2kk3BWpHHo?utm_source=messagedrop&utm_medium=referral',
    imageUrl: 'https://images.unsplash.com/photo-1570269825607-8cd7951ee3a6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxNXx8V2FzY2htaXR0ZWx8ZW58MHx8fHwxNzgyMjE0NjcxfDA&ixlib=rb-4.1.0&q=80&w=1080',
    downloadLocation: 'https://api.unsplash.com/photos/n2kk3BWpHHo/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxNXx8V2FzY2htaXR0ZWx8ZW58MHx8fHwxNzgyMjE0NjcxfDA'
  },
  dentalCare: {
    source: 'unsplash',
    authorName: 'Towfiqu barbhuiya',
    authorUrl: 'https://unsplash.com/de/@towfiqu999999?utm_source=messagedrop&utm_medium=referral',
    unsplashUrl: 'https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral',
    photoUrl: 'https://unsplash.com/photos/white-and-blue-toothbrush-in-white-ceramic-mug-rr0cuFV-0Mo?utm_source=messagedrop&utm_medium=referral',
    imageUrl: 'https://images.unsplash.com/photo-1625834319124-345137437603?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwyfHxaYWhuYiVDMyVCQ3JzdGV8ZW58MHx8fHwxNzgyMjE0NzE0fDA&ixlib=rb-4.1.0&q=80&w=1080',
    downloadLocation: 'https://api.unsplash.com/photos/rr0cuFV-0Mo/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwyfHxaYWhuYiVDMyVCQ3JzdGV8ZW58MHx8fHwxNzgyMjE0NzE0fDA'
  }
};

const hardwareStoreCategoryImage = (id: string): AvatarAttribution | undefined => HARDWARE_STORE_CATEGORY_IMAGES[id];
const hardwareStoreProductImage = (id: string): AvatarAttribution | undefined => HARDWARE_STORE_PRODUCT_IMAGES[id];
const hardwareStoreProduct = (id: string, unit: ShoppingUnit = 'package', quantity = 1): ShoppingProductTemplate =>
  product(id, unit, quantity, hardwareStoreProductImage(id));

const HARDWARE_STORE_CATEGORY_IMAGES: Record<string, AvatarAttribution> = {
  safety: {
    source: 'unsplash',
    authorName: 'Marc Zeman',
    authorUrl: 'https://unsplash.com/de/@der_zeman?utm_source=messagedrop&utm_medium=referral',
    unsplashUrl: 'https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral',
    photoUrl: 'https://unsplash.com/photos/a-man-wearing-a-white-hard-hat-and-black-jacket-2VI4kyU7cQ0?utm_source=messagedrop&utm_medium=referral',
    imageUrl: 'https://images.unsplash.com/photo-1646227655685-a530813759b3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHw3fHxBcmJlaXRzc2NodXR6fGVufDB8fHx8MTc4MjIxNTEwNXww&ixlib=rb-4.1.0&q=80&w=1080',
    downloadLocation: 'https://api.unsplash.com/photos/2VI4kyU7cQ0/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHw3fHxBcmJlaXRzc2NodXR6fGVufDB8fHx8MTc4MjIxNTEwNXww'
  },
  buildingMaterials: {
    source: 'unsplash',
    authorName: 'Árpád Czapp',
    authorUrl: 'https://unsplash.com/de/@czapp_arpad?utm_source=messagedrop&utm_medium=referral',
    unsplashUrl: 'https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral',
    photoUrl: 'https://unsplash.com/photos/a-warehouse-filled-with-lots-of-wooden-boxes-DwrIFyHuILM?utm_source=messagedrop&utm_medium=referral',
    imageUrl: 'https://images.unsplash.com/photo-1639038312723-75ba817ef552?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwyMnx8SG9seiUyMHVuZCUyMHN0YWhsfGVufDB8fHx8MTc4MjIxNTE3MHww&ixlib=rb-4.1.0&q=80&w=1080',
    downloadLocation: 'https://api.unsplash.com/photos/DwrIFyHuILM/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwyMnx8SG9seiUyMHVuZCUyMHN0YWhsfGVufDB8fHx8MTc4MjIxNTE3MHww'
  },
  fasteners: {
    source: 'unsplash',
    authorName: 'Roberto Sorin',
    authorUrl: 'https://unsplash.com/de/@roberto_sorin?utm_source=messagedrop&utm_medium=referral',
    unsplashUrl: 'https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral',
    photoUrl: 'https://unsplash.com/photos/a-bunch-of-screws-and-screws-on-a-table-yCyPRNLnFMM?utm_source=messagedrop&utm_medium=referral',
    imageUrl: 'https://images.unsplash.com/photo-1641937725629-2adda0f55251?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxfHx3aW5rZWwlMjB1bmQlMjBzY2hyYXViZW58ZW58MHx8fHwxNzgyMjE1MjM4fDA&ixlib=rb-4.1.0&q=80&w=1080',
    downloadLocation: 'https://api.unsplash.com/photos/yCyPRNLnFMM/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxfHx3aW5rZWwlMjB1bmQlMjBzY2hyYXViZW58ZW58MHx8fHwxNzgyMjE1MjM4fDA'
  },
  electrical: {
    source: 'unsplash',
    authorName: 'Toolmash Expo',
    authorUrl: 'https://unsplash.com/de/@toolmash?utm_source=messagedrop&utm_medium=referral',
    unsplashUrl: 'https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral',
    photoUrl: 'https://unsplash.com/photos/electrician-testing-electrical-panel-with-multimeter-PkHf7BUWbtk?utm_source=messagedrop&utm_medium=referral',
    imageUrl: 'https://images.unsplash.com/photo-1758101755915-462eddc23f57?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHw1fHxFbGVjdHJpY2FsJTIwU3VwcGxpZXN8ZW58MHx8fHwxNzgyMzgwMzUzfDA&ixlib=rb-4.1.0&q=80&w=1080',
    downloadLocation: 'https://api.unsplash.com/photos/PkHf7BUWbtk/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHw1fHxFbGVjdHJpY2FsJTIwU3VwcGxpZXN8ZW58MHx8fHwxNzgyMzgwMzUzfDA'
  },
  paint: {
    source: 'unsplash',
    authorName: 'Erik Mclean',
    authorUrl: 'https://unsplash.com/de/@introspectivedsgn?utm_source=messagedrop&utm_medium=referral',
    unsplashUrl: 'https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral',
    photoUrl: 'https://unsplash.com/photos/red-paint-brush-on-red-paint-WhfjkidtPQ0?utm_source=messagedrop&utm_medium=referral',
    imageUrl: 'https://images.unsplash.com/photo-1598818432507-cb12c18af0a3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHw4fHxXYW5kZmFyYmUlMjB1bmQlMjBwaW5zZWx8ZW58MHx8fHwxNzgyMjE1MjcxfDA&ixlib=rb-4.1.0&q=80&w=1080',
    downloadLocation: 'https://api.unsplash.com/photos/WhfjkidtPQ0/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHw4fHxXYW5kZmFyYmUlMjB1bmQlMjBwaW5zZWx8ZW58MHx8fHwxNzgyMjE1MjcxfDA'
  },
  garden: {
    source: 'unsplash',
    authorName: 'Trnava University',
    authorUrl: 'https://unsplash.com/de/@trnavskauni?utm_source=messagedrop&utm_medium=referral',
    unsplashUrl: 'https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral',
    photoUrl: 'https://unsplash.com/photos/a-bucket-filled-with-different-types-of-tools-UbRUk0QOAOY?utm_source=messagedrop&utm_medium=referral',
    imageUrl: 'https://images.unsplash.com/photo-1680598205089-4f95b6ffb6f3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwyOXx8R2FydGVuZ2VyJUMzJUE0dGV8ZW58MHx8fHwxNzgyMjE1MzAyfDA&ixlib=rb-4.1.0&q=80&w=1080',
    downloadLocation: 'https://api.unsplash.com/photos/UbRUk0QOAOY/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwyOXx8R2FydGVuZ2VyJUMzJUE0dGV8ZW58MHx8fHwxNzgyMjE1MzAyfDA'
  },
  plumbing: {
    source: 'unsplash',
    authorName: '99.films',
    authorUrl: 'https://unsplash.com/de/@99films?utm_source=messagedrop&utm_medium=referral',
    unsplashUrl: 'https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral',
    photoUrl: 'https://unsplash.com/photos/white-ceramic-toilet-bowl-beside-white-ceramic-toilet-bowl-48mTwDzizqE?utm_source=messagedrop&utm_medium=referral',
    imageUrl: 'https://images.unsplash.com/photo-1587527901949-ab0341697c1e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxfHx3Y3xlbnwwfHx8fDE3ODIyMTUzNTN8MA&ixlib=rb-4.1.0&q=80&w=1080',
    downloadLocation: 'https://api.unsplash.com/photos/48mTwDzizqE/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxfHx3Y3xlbnwwfHx8fDE3ODIyMTUzNTN8MA'
  },
  tools: {
    source: 'unsplash',
    authorName: 'Lachlan Donald',
    authorUrl: 'https://unsplash.com/de/@lox?utm_source=messagedrop&utm_medium=referral',
    unsplashUrl: 'https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral',
    photoUrl: 'https://unsplash.com/photos/hand-tool-on-wall-YVT5aF2QM7M?utm_source=messagedrop&utm_medium=referral',
    imageUrl: 'https://images.unsplash.com/photo-1522832712787-3fbd36c9fe2d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHw4fHx3ZXJremV1Z2V8ZW58MHx8fHwxNzgyMjE1Mzc4fDA&ixlib=rb-4.1.0&q=80&w=1080',
    downloadLocation: 'https://api.unsplash.com/photos/YVT5aF2QM7M/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHw4fHx3ZXJremV1Z2V8ZW58MHx8fHwxNzgyMjE1Mzc4fDA'
  }
};

const petStoreCategoryImage = (id: string): AvatarAttribution | undefined => PET_STORE_CATEGORY_IMAGES[id];

const PET_STORE_CATEGORY_IMAGES: Record<string, AvatarAttribution> = {
  aquarium: {
    source: 'unsplash',
    authorName: 'Rachel Hisko',
    authorUrl: 'https://unsplash.com/de/@rachelhisko?utm_source=messagedrop&utm_medium=referral',
    unsplashUrl: 'https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral',
    photoUrl: 'https://unsplash.com/photos/clown-fish-in-shallow-focus-photography-rEM3cK8F1pk?utm_source=messagedrop&utm_medium=referral',
    imageUrl: 'https://images.unsplash.com/photo-1535591273668-578e31182c4f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwzfHxBcXVhcml1bXxlbnwwfHx8fDE3ODIyMjA5Nzd8MA&ixlib=rb-4.1.0&q=80&w=1080',
    downloadLocation: 'https://api.unsplash.com/photos/rEM3cK8F1pk/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwzfHxBcXVhcml1bXxlbnwwfHx8fDE3ODIyMjA5Nzd8MA'
  },
  dog: {
    source: 'unsplash',
    authorName: 'Alvan Nee',
    authorUrl: 'https://unsplash.com/de/@alvannee?utm_source=messagedrop&utm_medium=referral',
    unsplashUrl: 'https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral',
    photoUrl: 'https://unsplash.com/photos/short-coated-brown-and-white-puppy-sitting-on-floor-brFsZ7qszSY?utm_source=messagedrop&utm_medium=referral',
    imageUrl: 'https://images.unsplash.com/photo-1537151625747-768eb6cf92b2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxMnx8SHVuZHxlbnwwfHx8fDE3ODIyMjEwMTh8MA&ixlib=rb-4.1.0&q=80&w=1080',
    downloadLocation: 'https://api.unsplash.com/photos/brFsZ7qszSY/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxMnx8SHVuZHxlbnwwfHx8fDE3ODIyMjEwMTh8MA'
  },
  cat: {
    source: 'unsplash',
    authorName: 'Ludemeula Fernandes',
    authorUrl: 'https://unsplash.com/de/@ludemeula?utm_source=messagedrop&utm_medium=referral',
    unsplashUrl: 'https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral',
    photoUrl: 'https://unsplash.com/photos/orange-persian-cat-sleeping-9UUoGaaHtNE?utm_source=messagedrop&utm_medium=referral',
    imageUrl: 'https://images.unsplash.com/photo-1511044568932-338cba0ad803?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHw3fHxLYXR6ZXxlbnwwfHx8fDE3ODIyMjEwNDZ8MA&ixlib=rb-4.1.0&q=80&w=1080',
    downloadLocation: 'https://api.unsplash.com/photos/9UUoGaaHtNE/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHw3fHxLYXR6ZXxlbnwwfHx8fDE3ODIyMjEwNDZ8MA'
  },
  smallAnimals: {
    source: 'unsplash',
    authorName: 'Zhaoli JIN',
    authorUrl: 'https://unsplash.com/de/@godling?utm_source=messagedrop&utm_medium=referral',
    unsplashUrl: 'https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral',
    photoUrl: 'https://unsplash.com/photos/a-small-hamster-sitting-on-top-of-a-table-cgnDJkzWkTg?utm_source=messagedrop&utm_medium=referral',
    imageUrl: 'https://images.unsplash.com/photo-1721327900411-b315dce4388e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHw0fHxIYW1zdGVyfGVufDB8fHx8MTc4MjIyMTA5MXww&ixlib=rb-4.1.0&q=80&w=1080',
    downloadLocation: 'https://api.unsplash.com/photos/cgnDJkzWkTg/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHw0fHxIYW1zdGVyfGVufDB8fHx8MTc4MjIyMTA5MXww'
  },
  petCare: {
    source: 'unsplash',
    authorName: 'Dhaya Eddine Bentaleb',
    authorUrl: 'https://unsplash.com/de/@dhayaeddinebentaleb?utm_source=messagedrop&utm_medium=referral',
    unsplashUrl: 'https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral',
    photoUrl: 'https://unsplash.com/photos/red-heart-ornament-on-green-textile-nPGV7whyrjE?utm_source=messagedrop&utm_medium=referral',
    imageUrl: 'https://images.unsplash.com/photo-1613089222731-8841ac989caa?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxMXx8UGZsZWdlfGVufDB8fHx8MTc4MjIyMTIxOHww&ixlib=rb-4.1.0&q=80&w=1080',
    downloadLocation: 'https://api.unsplash.com/photos/nPGV7whyrjE/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwxMXx8UGZsZWdlfGVufDB8fHx8MTc4MjIyMTIxOHww'
  },
  birds: {
    source: 'unsplash',
    authorName: 'Siegfried Poepperl',
    authorUrl: 'https://unsplash.com/de/@siegfriedpoepperl?utm_source=messagedrop&utm_medium=referral',
    unsplashUrl: 'https://unsplash.com/de/?utm_source=messagedrop&utm_medium=referral',
    photoUrl: 'https://unsplash.com/photos/a-couple-of-birds-that-are-sitting-in-a-tree-_8JpxqAtNN0?utm_source=messagedrop&utm_medium=referral',
    imageUrl: 'https://images.unsplash.com/photo-1727259860978-7a049df48ffe?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwyOHx8UGFwYWdlaXxlbnwwfHx8fDE3ODIyMjEyNTJ8MA&ixlib=rb-4.1.0&q=80&w=1080',
    downloadLocation: 'https://api.unsplash.com/photos/_8JpxqAtNN0/download?ixid=M3w4NTM1MTR8MHwxfHNlYXJjaHwyOHx8UGFwYWdlaXxlbnwwfHx8fDE3ODIyMjEyNTJ8MA'
  }
};

export const SHOPPING_STORE_TEMPLATES: readonly ShoppingStoreTemplate[] = [
  {
    id: 'supermarket', icon: 'local_grocery_store', categories: [
      { id: 'fruit', image: supermarketCategoryImage('fruit'), products: [supermarketProduct('apples', 'kilogram'), supermarketProduct('bananas', 'kilogram'), supermarketProduct('berries'), supermarketProduct('grapes', 'kilogram'), supermarketProduct('kiwis', 'piece'), supermarketProduct('lemons', 'piece'), supermarketProduct('oranges', 'kilogram'), supermarketProduct('pears', 'kilogram')] },
      { id: 'vegetables', image: supermarketCategoryImage('vegetables'), products: [supermarketProduct('avocados', 'piece'), supermarketProduct('broccoli', 'piece'), supermarketProduct('carrots', 'kilogram'), supermarketProduct('cucumbers', 'piece'), supermarketProduct('garlic'), supermarketProduct('lettuce', 'piece'), supermarketProduct('mushrooms'), supermarketProduct('onions', 'kilogram'), supermarketProduct('peppers'), supermarketProduct('potatoes', 'kilogram'), supermarketProduct('tomatoes', 'kilogram'), supermarketProduct('zucchini', 'piece')] },
      { id: 'bakery', image: supermarketCategoryImage('bakery'), products: [supermarketProduct('baguette', 'piece'), supermarketProduct('bread', 'piece'), supermarketProduct('cake'), supermarketProduct('crispbread'), supermarketProduct('rolls', 'piece', 4), supermarketProduct('toast'), supermarketProduct('wraps')] },
      { id: 'dairy', image: supermarketCategoryImage('dairy'), products: [supermarketProduct('butter'), supermarketProduct('cheese'), supermarketProduct('cream'), supermarketProduct('creamCheese'), supermarketProduct('eggs'), supermarketProduct('milk', 'liter'), supermarketProduct('quark'), supermarketProduct('sourCream'), supermarketProduct('yogurt')] },
      { id: 'meat', image: supermarketCategoryImage('meat'), products: [supermarketProduct('beef'), supermarketProduct('chicken'), supermarketProduct('coldCuts'), supermarketProduct('groundMeat'), supermarketProduct('ham'), supermarketProduct('pork'), supermarketProduct('sausages')] },
      { id: 'fish', image: supermarketCategoryImage('fish'), products: [supermarketProduct('fishFillet'), supermarketProduct('salmon'), supermarketProduct('seafood'), supermarketProduct('smokedFish'), supermarketProduct('tuna')] },
      { id: 'breakfast', image: supermarketCategoryImage('breakfast'), products: [supermarketProduct('cereal'), supermarketProduct('coffee'), supermarketProduct('honey', 'jar'), supermarketProduct('jam', 'jar'), supermarketProduct('muesli'), supermarketProduct('tea')] },
      { id: 'pantry', image: supermarketCategoryImage('pantry'), products: [supermarketProduct('cookingOil', 'bottle'), supermarketProduct('flour', 'kilogram'), supermarketProduct('pasta'), supermarketProduct('rice', 'kilogram'), supermarketProduct('salt'), supermarketProduct('sugar', 'kilogram'), supermarketProduct('vinegar', 'bottle')] },
      { id: 'cannedGoods', image: supermarketCategoryImage('cannedGoods'), products: [supermarketProduct('beans', 'can'), supermarketProduct('cannedCorn', 'can'), supermarketProduct('cannedTomatoes', 'can'), supermarketProduct('chickpeas', 'can'), supermarketProduct('coconutMilk', 'can'), supermarketProduct('soups', 'can')] },
      { id: 'spicesSauces', image: supermarketCategoryImage('spicesSauces'), products: [supermarketProduct('herbs'), supermarketProduct('ketchup', 'bottle'), supermarketProduct('mayonnaise', 'jar'), supermarketProduct('mustard', 'jar'), supermarketProduct('pepper'), supermarketProduct('spices'), supermarketProduct('tomatoSauce', 'jar')] },
      { id: 'snacksSweets', image: supermarketCategoryImage('snacksSweets'), products: [supermarketProduct('biscuits'), supermarketProduct('chips'), supermarketProduct('chocolate'), supermarketProduct('gummyCandy'), supermarketProduct('nuts'), supermarketProduct('popcorn')] },
      { id: 'drinks', image: supermarketCategoryImage('drinks'), products: [supermarketProduct('beer', 'bottle'), supermarketProduct('juice', 'bottle'), supermarketProduct('lemonade', 'bottle'), supermarketProduct('softDrinks', 'bottle'), supermarketProduct('water', 'bottle'), supermarketProduct('wine', 'bottle')] },
      { id: 'frozen', image: supermarketCategoryImage('frozen'), products: [supermarketProduct('fishSticks'), supermarketProduct('frozenFruit'), supermarketProduct('frozenVegetables'), supermarketProduct('iceCream'), supermarketProduct('pizza'), supermarketProduct('readyMeals')] },
      { id: 'household', image: supermarketCategoryImage('household'), products: [supermarketProduct('aluminumFoil'), supermarketProduct('bakingPaper'), supermarketProduct('dishSoap', 'bottle'), supermarketProduct('kitchenRoll'), supermarketProduct('trashBags'), supermarketProduct('toiletPaper')] }
    ]
  },
  {
    id: 'drugstore', icon: 'health_and_beauty', categories: [
      { id: 'bodyCare', image: drugstoreCategoryImage('bodyCare'), products: [drugstoreProduct('bodyLotion', 'bottle'), drugstoreProduct('deodorant', 'piece'), drugstoreProduct('handCream'), drugstoreProduct('razors'), drugstoreProduct('shavingFoam', 'can'), drugstoreProduct('showerGel', 'bottle'), drugstoreProduct('soap', 'piece'), drugstoreProduct('sunscreen', 'bottle')] },
      { id: 'hairCare', image: drugstoreCategoryImage('hairCare'), products: [drugstoreProduct('conditioner', 'bottle'), drugstoreProduct('hairColor'), drugstoreProduct('hairGel'), drugstoreProduct('hairSpray', 'can'), drugstoreProduct('hairTreatment'), drugstoreProduct('shampoo', 'bottle')] },
      { id: 'dentalCare', image: drugstoreCategoryImage('dentalCare'), products: [drugstoreProduct('dentalFloss', 'piece'), drugstoreProduct('interdentalBrushes'), drugstoreProduct('mouthwash', 'bottle'), drugstoreProduct('toothbrush', 'piece'), drugstoreProduct('toothpaste', 'piece')] },
      { id: 'facialCare', image: drugstoreCategoryImage('facialCare'), products: [drugstoreProduct('cleansingGel', 'bottle'), drugstoreProduct('cottonPads'), drugstoreProduct('faceCream'), drugstoreProduct('faceMasks'), drugstoreProduct('lipCare'), drugstoreProduct('makeupRemover', 'bottle')] },
      { id: 'personalHygiene', image: drugstoreCategoryImage('personalHygiene'), products: [drugstoreProduct('condoms'), drugstoreProduct('cottonSwabs'), drugstoreProduct('incontinenceProducts'), drugstoreProduct('sanitaryPads'), drugstoreProduct('tampons'), drugstoreProduct('wetWipes')] },
      { id: 'babyCare', image: drugstoreCategoryImage('babyCare'), products: [drugstoreProduct('babyFood'), drugstoreProduct('babyOil', 'bottle'), drugstoreProduct('babyWipes'), drugstoreProduct('diapers'), drugstoreProduct('nursingPads'), drugstoreProduct('rashCream')] },
      { id: 'cleaning', image: drugstoreCategoryImage('cleaning'), products: [drugstoreProduct('allPurposeCleaner', 'bottle'), drugstoreProduct('bathroomCleaner', 'bottle'), drugstoreProduct('cleaningCloths'), drugstoreProduct('dishwasherTablets'), drugstoreProduct('glassCleaner', 'bottle'), drugstoreProduct('sponges'), drugstoreProduct('toiletCleaner', 'bottle')] },
      { id: 'laundry', image: drugstoreCategoryImage('laundry'), products: [drugstoreProduct('fabricSoftener', 'bottle'), drugstoreProduct('laundryDetergent'), drugstoreProduct('laundryDisinfectant', 'bottle'), drugstoreProduct('stainRemover'), drugstoreProduct('washingBags')] },
      { id: 'paperGoods', image: drugstoreCategoryImage('paperGoods'), products: [drugstoreProduct('facialTissues'), drugstoreProduct('kitchenRoll'), drugstoreProduct('napkins'), drugstoreProduct('tissues'), drugstoreProduct('toiletPaper')] }
    ]
  },
  {
    id: 'hardwareStore', icon: 'hardware', categories: [
      { id: 'tools', image: hardwareStoreCategoryImage('tools'), products: [hardwareStoreProduct('cordlessDrill', 'piece'), hardwareStoreProduct('hammer', 'piece'), hardwareStoreProduct('level', 'piece'), hardwareStoreProduct('pliers', 'piece'), hardwareStoreProduct('screwdriver', 'piece'), hardwareStoreProduct('tapeMeasure', 'piece'), hardwareStoreProduct('utilityKnife', 'piece'), hardwareStoreProduct('wrench', 'piece')] },
      { id: 'fasteners', image: hardwareStoreCategoryImage('fasteners'), products: [hardwareStoreProduct('adhesive', 'piece'), hardwareStoreProduct('cableTies'), hardwareStoreProduct('dowels'), hardwareStoreProduct('hooks'), hardwareStoreProduct('nails'), hardwareStoreProduct('nuts'), hardwareStoreProduct('screws'), hardwareStoreProduct('washers')] },
      { id: 'paint', image: hardwareStoreCategoryImage('paint'), products: [hardwareStoreProduct('brushes', 'piece'), hardwareStoreProduct('filler'), hardwareStoreProduct('maskingTape', 'piece'), hardwareStoreProduct('paintRollers', 'piece'), hardwareStoreProduct('sandpaper'), hardwareStoreProduct('varnish', 'can'), hardwareStoreProduct('wallPaint', 'can')] },
      { id: 'electrical', image: hardwareStoreCategoryImage('electrical'), products: [hardwareStoreProduct('batteries'), hardwareStoreProduct('cables'), hardwareStoreProduct('extensionCord', 'piece'), hardwareStoreProduct('fuses'), hardwareStoreProduct('lightBulbs'), hardwareStoreProduct('powerStrip', 'piece'), hardwareStoreProduct('sockets'), hardwareStoreProduct('switches')] },
      { id: 'plumbing', image: hardwareStoreCategoryImage('plumbing'), products: [hardwareStoreProduct('faucet', 'piece'), hardwareStoreProduct('fittings'), hardwareStoreProduct('pipeSealTape', 'piece'), hardwareStoreProduct('pipes'), hardwareStoreProduct('plunger', 'piece'), hardwareStoreProduct('seals')] },
      { id: 'buildingMaterials', image: hardwareStoreCategoryImage('buildingMaterials'), products: [hardwareStoreProduct('cement', 'bag'), hardwareStoreProduct('drywall'), hardwareStoreProduct('insulation'), hardwareStoreProduct('mortar', 'bag'), hardwareStoreProduct('silicone', 'piece'), hardwareStoreProduct('wood')] },
      { id: 'garden', image: hardwareStoreCategoryImage('garden'), products: [hardwareStoreProduct('fertilizer'), hardwareStoreProduct('gardenGloves'), hardwareStoreProduct('gardenTools'), hardwareStoreProduct('plantPots', 'piece'), hardwareStoreProduct('pottingSoil', 'bag'), hardwareStoreProduct('seeds'), hardwareStoreProduct('wateringCan', 'piece')] },
      { id: 'safety', image: hardwareStoreCategoryImage('safety'), products: [hardwareStoreProduct('dustMasks'), hardwareStoreProduct('earProtection'), hardwareStoreProduct('safetyGlasses', 'piece'), hardwareStoreProduct('workGloves'), hardwareStoreProduct('workShoes')] }
    ]
  },
  {
    id: 'petStore', icon: 'pets', categories: [
      { id: 'dog', image: petStoreCategoryImage('dog'), products: [product('dogFood', 'bag'), product('dogLeash', 'piece'), product('dogTreats'), product('dogToy', 'piece'), product('foodBowl', 'piece'), product('wasteBags')] },
      { id: 'cat', image: petStoreCategoryImage('cat'), products: [product('catFood'), product('catLitter', 'bag'), product('catTreats'), product('catToy', 'piece'), product('litterBox', 'piece'), product('scratchingPost', 'piece')] },
      { id: 'smallAnimals', image: petStoreCategoryImage('smallAnimals'), products: [product('bedding', 'bag'), product('hay', 'bag'), product('smallAnimalFood', 'bag'), product('smallAnimalTreats'), product('waterBottle', 'piece')] },
      { id: 'birds', image: petStoreCategoryImage('birds'), products: [product('birdFood', 'bag'), product('birdSand', 'bag'), product('birdTreats'), product('cuttlebone', 'piece'), product('perches')] },
      { id: 'aquarium', image: petStoreCategoryImage('aquarium'), products: [product('aquariumFilter'), product('fishFood'), product('gravel', 'bag'), product('waterConditioner', 'bottle'), product('waterTest')] },
      { id: 'petCare', image: petStoreCategoryImage('petCare'), products: [product('fleaTreatment'), product('petBrush', 'piece'), product('petShampoo', 'bottle'), product('tickRemover', 'piece'), product('wormingTreatment')] }
    ]
  }
];
