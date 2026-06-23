import { AvatarAttribution } from '../../../interfaces/avatar-attribution';
import { ShoppingUnit } from '../../../interfaces/tile-settings';

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

const product = (id: string, unit: ShoppingUnit = 'package', quantity = 1): ShoppingProductTemplate => ({ id, unit, quantity });

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


const drugstoreCategoryImage = (id: string): AvatarAttribution | undefined => DRUGSTORE_CATEGORY_IMAGES[id];

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
      { id: 'fruit', image: supermarketCategoryImage('fruit'), products: [product('apples', 'kilogram'), product('bananas', 'kilogram'), product('berries'), product('grapes', 'kilogram'), product('kiwis', 'piece'), product('lemons', 'piece'), product('oranges', 'kilogram'), product('pears', 'kilogram')] },
      { id: 'vegetables', image: supermarketCategoryImage('vegetables'), products: [product('avocados', 'piece'), product('broccoli', 'piece'), product('carrots', 'kilogram'), product('cucumbers', 'piece'), product('garlic'), product('lettuce', 'piece'), product('mushrooms'), product('onions', 'kilogram'), product('peppers'), product('potatoes', 'kilogram'), product('tomatoes', 'kilogram'), product('zucchini', 'piece')] },
      { id: 'bakery', image: supermarketCategoryImage('bakery'), products: [product('baguette', 'piece'), product('bread', 'piece'), product('cake'), product('crispbread'), product('rolls', 'piece', 4), product('toast'), product('wraps')] },
      { id: 'dairy', image: supermarketCategoryImage('dairy'), products: [product('butter'), product('cheese'), product('cream'), product('creamCheese'), product('eggs'), product('milk', 'liter'), product('quark'), product('sourCream'), product('yogurt')] },
      { id: 'meat', image: supermarketCategoryImage('meat'), products: [product('beef'), product('chicken'), product('coldCuts'), product('groundMeat'), product('ham'), product('pork'), product('sausages')] },
      { id: 'fish', image: supermarketCategoryImage('fish'), products: [product('fishFillet'), product('salmon'), product('seafood'), product('smokedFish'), product('tuna')] },
      { id: 'breakfast', image: supermarketCategoryImage('breakfast'), products: [product('cereal'), product('coffee'), product('honey', 'jar'), product('jam', 'jar'), product('muesli'), product('tea')] },
      { id: 'pantry', image: supermarketCategoryImage('pantry'), products: [product('cookingOil', 'bottle'), product('flour', 'kilogram'), product('pasta'), product('rice', 'kilogram'), product('salt'), product('sugar', 'kilogram'), product('vinegar', 'bottle')] },
      { id: 'cannedGoods', image: supermarketCategoryImage('cannedGoods'), products: [product('beans', 'can'), product('cannedCorn', 'can'), product('cannedTomatoes', 'can'), product('chickpeas', 'can'), product('coconutMilk', 'can'), product('soups', 'can')] },
      { id: 'spicesSauces', image: supermarketCategoryImage('spicesSauces'), products: [product('herbs'), product('ketchup', 'bottle'), product('mayonnaise', 'jar'), product('mustard', 'jar'), product('pepper'), product('spices'), product('tomatoSauce', 'jar')] },
      { id: 'snacksSweets', image: supermarketCategoryImage('snacksSweets'), products: [product('biscuits'), product('chips'), product('chocolate'), product('gummyCandy'), product('nuts'), product('popcorn')] },
      { id: 'drinks', image: supermarketCategoryImage('drinks'), products: [product('beer', 'bottle'), product('juice', 'bottle'), product('lemonade', 'bottle'), product('softDrinks', 'bottle'), product('water', 'bottle'), product('wine', 'bottle')] },
      { id: 'frozen', image: supermarketCategoryImage('frozen'), products: [product('fishSticks'), product('frozenFruit'), product('frozenVegetables'), product('iceCream'), product('pizza'), product('readyMeals')] },
      { id: 'household', image: supermarketCategoryImage('household'), products: [product('aluminumFoil'), product('bakingPaper'), product('dishSoap', 'bottle'), product('kitchenRoll'), product('trashBags'), product('toiletPaper')] }
    ]
  },
  {
    id: 'drugstore', icon: 'health_and_beauty', categories: [
      { id: 'bodyCare', image: drugstoreCategoryImage('bodyCare'), products: [product('bodyLotion', 'bottle'), product('deodorant', 'piece'), product('handCream'), product('razors'), product('shavingFoam', 'can'), product('showerGel', 'bottle'), product('soap', 'piece'), product('sunscreen', 'bottle')] },
      { id: 'hairCare', image: drugstoreCategoryImage('hairCare'), products: [product('conditioner', 'bottle'), product('hairColor'), product('hairGel'), product('hairSpray', 'can'), product('hairTreatment'), product('shampoo', 'bottle')] },
      { id: 'dentalCare', image: drugstoreCategoryImage('dentalCare'), products: [product('dentalFloss', 'piece'), product('interdentalBrushes'), product('mouthwash', 'bottle'), product('toothbrush', 'piece'), product('toothpaste', 'piece')] },
      { id: 'facialCare', image: drugstoreCategoryImage('facialCare'), products: [product('cleansingGel', 'bottle'), product('cottonPads'), product('faceCream'), product('faceMasks'), product('lipCare'), product('makeupRemover', 'bottle')] },
      { id: 'personalHygiene', image: drugstoreCategoryImage('personalHygiene'), products: [product('condoms'), product('cottonSwabs'), product('incontinenceProducts'), product('sanitaryPads'), product('tampons'), product('wetWipes')] },
      { id: 'babyCare', image: drugstoreCategoryImage('babyCare'), products: [product('babyFood'), product('babyOil', 'bottle'), product('babyWipes'), product('diapers'), product('nursingPads'), product('rashCream')] },
      { id: 'cleaning', image: drugstoreCategoryImage('cleaning'), products: [product('allPurposeCleaner', 'bottle'), product('bathroomCleaner', 'bottle'), product('cleaningCloths'), product('dishwasherTablets'), product('glassCleaner', 'bottle'), product('sponges'), product('toiletCleaner', 'bottle')] },
      { id: 'laundry', image: drugstoreCategoryImage('laundry'), products: [product('fabricSoftener', 'bottle'), product('laundryDetergent'), product('laundryDisinfectant', 'bottle'), product('stainRemover'), product('washingBags')] },
      { id: 'paperGoods', image: drugstoreCategoryImage('paperGoods'), products: [product('facialTissues'), product('kitchenRoll'), product('napkins'), product('tissues'), product('toiletPaper')] }
    ]
  },
  {
    id: 'hardwareStore', icon: 'hardware', categories: [
      { id: 'tools', image: hardwareStoreCategoryImage('tools'), products: [product('cordlessDrill', 'piece'), product('hammer', 'piece'), product('level', 'piece'), product('pliers', 'piece'), product('screwdriver', 'piece'), product('tapeMeasure', 'piece'), product('utilityKnife', 'piece'), product('wrench', 'piece')] },
      { id: 'fasteners', image: hardwareStoreCategoryImage('fasteners'), products: [product('adhesive', 'piece'), product('cableTies'), product('dowels'), product('hooks'), product('nails'), product('nuts'), product('screws'), product('washers')] },
      { id: 'paint', image: hardwareStoreCategoryImage('paint'), products: [product('brushes', 'piece'), product('filler'), product('maskingTape', 'piece'), product('paintRollers', 'piece'), product('sandpaper'), product('varnish', 'can'), product('wallPaint', 'can')] },
      { id: 'electrical', products: [product('batteries'), product('cables'), product('extensionCord', 'piece'), product('fuses'), product('lightBulbs'), product('powerStrip', 'piece'), product('sockets'), product('switches')] },
      { id: 'plumbing', image: hardwareStoreCategoryImage('plumbing'), products: [product('faucet', 'piece'), product('fittings'), product('pipeSealTape', 'piece'), product('pipes'), product('plunger', 'piece'), product('seals')] },
      { id: 'buildingMaterials', image: hardwareStoreCategoryImage('buildingMaterials'), products: [product('cement', 'bag'), product('drywall'), product('insulation'), product('mortar', 'bag'), product('silicone', 'piece'), product('wood')] },
      { id: 'garden', image: hardwareStoreCategoryImage('garden'), products: [product('fertilizer'), product('gardenGloves'), product('gardenTools'), product('plantPots', 'piece'), product('pottingSoil', 'bag'), product('seeds'), product('wateringCan', 'piece')] },
      { id: 'safety', image: hardwareStoreCategoryImage('safety'), products: [product('dustMasks'), product('earProtection'), product('safetyGlasses', 'piece'), product('workGloves'), product('workShoes')] }
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
