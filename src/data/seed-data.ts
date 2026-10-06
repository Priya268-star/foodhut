/**
 * Demo dataset for `npm run seed`.
 *
 * Kept separate from the app bundle — this module is only ever imported by the
 * seed scripts, never by the browser.
 *
 * Images are local files under `public/dishes/`, fetched by
 * `scripts/fetch-dish-images.mts` and wired up by `scripts/wire-seed-images.mts`.
 * This dataset used to carry hand-written Unsplash photo ids, which turned out
 * to be unchecked guesses: a pizza shot under "Tiramisu", and Butter Chicken and
 * Chicken 65 sharing one image. Anything without a verifiable photo gets a
 * generated placeholder card instead — see
 * `scripts/generate-image-placeholders.mts`.
 */

interface SeedMenuItem {
  id: string;
  name: string;
  description: string;
  /** Paise, matching the app's money model. */
  price: number;
  imageUrl: string;
  category: string;
  isVeg: boolean;
  isAvailable: boolean;
  rating: number;
  ratingCount: number;
  sortOrder: number;
}

interface SeedRestaurant {
  id: string;
  name: string;
  description: string;
  cuisines: string[];
  imageUrl: string;
  coverImageUrl: string | null;
  rating: number;
  ratingCount: number;
  deliveryTimeMinutes: number;
  deliveryFee: number;
  priceLevel: 1 | 2 | 3 | 4;
  location: { area: string; city: string; landmark?: string };
  isOpen: boolean;
  isAcceptingOrders: boolean;
  isFeatured: boolean;
  menu: SeedMenuItem[];
}

export const SEED_OWNER = {
  uid: 'seed-owner-uid',
  displayName: 'Foodhut Demo Owner',
  email: 'owner@foodhut.test',
  phone: '+919800000000',
} as const;

export const SEED_RESTAURANTS: SeedRestaurant[] = [
  {
    id: 'truffle-affairs',
    name: 'Truffle Affairs',
    description:
      'Wood-fired pizzas, hand-made pastas and a dessert counter worth saving room for. Sourdough is proofed for 48 hours.',
    cuisines: ['Pizza', 'Italian', 'Desserts'],
    imageUrl: '/dishes/cover-pizza-pasta.jpg',
    coverImageUrl: '/dishes/cover-pizza-pasta.jpg',
    rating: 4.6,
    ratingCount: 1284,
    deliveryTimeMinutes: 35,
    deliveryFee: 4900,
    priceLevel: 3,
    location: { area: 'Indiranagar', city: 'Bengaluru', landmark: '12th Main' },
    isOpen: true,
    isAcceptingOrders: true,
    isFeatured: true,
    menu: [
      {
        id: 'ta-1',
        name: 'Truffle Mushroom Pizza',
        description:
          'Wild mushrooms, truffle cream, mozzarella and a thyme oil drizzle on a thin crust.',
        price: 54900,
        imageUrl: '/dishes/truffle-mushroom-pizza.jpg',
        category: 'Pizza',
        isVeg: true,
        isAvailable: true,
        rating: 4.7,
        ratingCount: 412,
        sortOrder: 1,
      },
      {
        id: 'ta-2',
        name: 'Spicy Arrabbiata',
        description: 'Slow-simmered San Marzano tomato, garlic, chilli and basil. Vegetarian.',
        price: 42900,
        imageUrl: '/dishes/spicy-arrabbiata.jpg',
        category: 'Pizza',
        isVeg: true,
        isAvailable: true,
        rating: 4.4,
        ratingCount: 288,
        sortOrder: 2,
      },
      {
        id: 'ta-3',
        name: 'Chicken Pesto Penne',
        description: 'Grilled chicken, basil pesto, cherry tomatoes and parmesan tossed in penne.',
        price: 49900,
        imageUrl: '/dishes/chicken-pesto-penne.jpg',
        category: 'Pasta',
        isVeg: false,
        isAvailable: true,
        rating: 4.6,
        ratingCount: 331,
        sortOrder: 3,
      },
      {
        id: 'ta-4',
        name: 'Alfredo Fettuccine',
        description: 'Classic cream and parmesan sauce with fresh cracked pepper.',
        price: 38900,
        imageUrl: '/dishes/alfredo-fettuccine.jpg',
        category: 'Pasta',
        isVeg: true,
        isAvailable: true,
        rating: 4.3,
        ratingCount: 197,
        sortOrder: 4,
      },
      {
        /*
         * Renamed from "Tiramisu": the photograph actually supplied for this slot
         * is a chocolate cherry layer cake, and showing one thing under another
         * thing's name is the exact mistake this project's image rules exist to
         * prevent. The slug stays `tiramisu` so the deployed file path, which
         * Firestore also references, does not change.
         */
        id: 'ta-5',
        name: 'Chocolate Cherry Cake',
        description:
          'Three layers of dark chocolate sponge with whipped cream and candied cherries. Finished to order.',
        price: 32900,
        imageUrl: '/dishes/tiramisu.jpg',
        category: 'Desserts',
        isVeg: true,
        isAvailable: true,
        rating: 4.8,
        ratingCount: 256,
        sortOrder: 5,
      },
      {
        id: 'ta-6',
        name: 'Strawberry Sundae',
        description: 'Two scoops of strawberry ice cream, warm chocolate sauce and fresh strawberries.',
        price: 21900,
        imageUrl: '/dishes/strawberry-sundae.jpg',
        category: 'Desserts',
        isVeg: true,
        isAvailable: true,
        rating: 4.6,
        ratingCount: 178,
        sortOrder: 6,
      },
    ],
  },

  {
    id: 'saffron-junction',
    name: 'Saffron Junction',
    description:
      'North Indian classics done properly — hand-ground masalas, slow-cooked curries and oven-fired naan.',
    cuisines: ['North Indian', 'Mughlai', 'Biryani'],
    imageUrl: '/dishes/cover-north-indian.jpg',
    coverImageUrl: '/dishes/cover-north-indian.jpg',
    rating: 4.5,
    ratingCount: 2140,
    deliveryTimeMinutes: 40,
    deliveryFee: 3900,
    priceLevel: 2,
    location: { area: 'Koramangala', city: 'Bengaluru', landmark: '80 Feet Road' },
    isOpen: true,
    isAcceptingOrders: true,
    isFeatured: true,
    menu: [
      {
        id: 'sj-1',
        name: 'Butter Chicken',
        description:
          'Tandoori chicken in a rich tomato and cashew gravy finished with white butter.',
        price: 44900,
        imageUrl: '/dishes/butter-chicken.jpg',
        category: 'Curries',
        isVeg: false,
        isAvailable: true,
        rating: 4.8,
        ratingCount: 892,
        sortOrder: 1,
      },
      {
        id: 'sj-2',
        name: 'Paneer Butter Masala',
        description: 'Soft paneer cubes in a mildly sweet tomato gravy with a cream swirl.',
        price: 39900,
        imageUrl: '/dishes/paneer-butter-masala.jpg',
        category: 'Curries',
        isVeg: true,
        isAvailable: true,
        rating: 4.7,
        ratingCount: 703,
        sortOrder: 2,
      },
      {
        id: 'sj-3',
        name: 'Dal Makhani',
        description: 'Black urad simmered overnight on low coals with butter and cream.',
        price: 29900,
        imageUrl: '/dishes/dal-makhani.jpg',
        category: 'Curries',
        isVeg: true,
        isAvailable: true,
        rating: 4.6,
        ratingCount: 512,
        sortOrder: 3,
      },
      {
        id: 'sj-4',
        name: 'Hyderabadi Dum Biryani',
        description: 'Sealed-pot biryani with long-grain basmati, saffron and fried onions.',
        price: 46900,
        imageUrl: '/dishes/hyderabadi-dum-biryani.jpg',
        category: 'Biryani',
        isVeg: false,
        isAvailable: true,
        rating: 4.9,
        ratingCount: 1044,
        sortOrder: 4,
      },
      {
        id: 'sj-5',
        name: 'Garlic Naan',
        description: 'Tandoor-baked, brushed with garlic butter and coriander.',
        price: 8900,
        imageUrl: '/dishes/garlic-naan.jpg',
        category: 'Breads',
        isVeg: true,
        isAvailable: true,
        rating: 4.5,
        ratingCount: 620,
        sortOrder: 5,
      },
    ],
  },

  {
    id: 'wok-theory',
    name: 'Wok Theory',
    description:
      'Indo-Chinese wok dishes with a proper flame. Everything is tossed to order, so it arrives hot.',
    cuisines: ['Chinese', 'Fast Food'],
    imageUrl: '/dishes/cover-chinese.jpg',
    coverImageUrl: '/dishes/cover-chinese.jpg',
    rating: 4.3,
    ratingCount: 1876,
    deliveryTimeMinutes: 28,
    deliveryFee: 2900,
    priceLevel: 2,
    location: { area: 'HSR Layout', city: 'Bengaluru', landmark: 'Sector 2' },
    isOpen: true,
    isAcceptingOrders: true,
    isFeatured: false,
    menu: [
      {
        id: 'wt-1',
        name: 'Burnt Garlic Noodles',
        description: 'Wok-tossed noodles with charred garlic, spring onion and a dark soy glaze.',
        price: 27900,
        imageUrl: '/dishes/burnt-garlic-noodles.jpg',
        category: 'Noodles',
        isVeg: true,
        isAvailable: true,
        rating: 4.4,
        ratingCount: 534,
        sortOrder: 1,
      },
      {
        id: 'wt-2',
        name: 'Chicken 65',
        description: 'Crisp fried chicken with curry leaf, red chilli and a squeeze of lime.',
        price: 34900,
        imageUrl: '/dishes/chicken-65.jpg',
        category: 'Starters',
        isVeg: false,
        isAvailable: true,
        rating: 4.6,
        ratingCount: 401,
        sortOrder: 2,
      },
      {
        id: 'wt-3',
        name: 'Chilli Garlic Paneer',
        description: 'Soft paneer tossed with garlic, green chilli and spring onion.',
        price: 31900,
        imageUrl: '/dishes/chilli-garlic-paneer.jpg',
        category: 'Starters',
        isVeg: true,
        isAvailable: true,
        rating: 4.2,
        ratingCount: 288,
        sortOrder: 3,
      },
      {
        id: 'wt-4',
        name: 'Veg Manchurian',
        description: 'Golden-fried vegetable dumplings in a mildly spicy soy glaze.',
        price: 28900,
        imageUrl: '/dishes/veg-manchurian.jpg',
        category: 'Starters',
        isVeg: true,
        isAvailable: true,
        rating: 4.1,
        ratingCount: 356,
        sortOrder: 4,
      },
    ],
  },

  {
    id: 'smoke-and-salt',
    name: 'Smoke & Salt',
    description:
      'Smash burgers and loaded fries. The patties are pressed to order — expect a short wait.',
    cuisines: ['Burgers', 'Fast Food', 'American'],
    imageUrl: '/dishes/cover-burgers.jpg',
    coverImageUrl: '/dishes/cover-burgers.jpg',
    rating: 4.4,
    ratingCount: 3201,
    deliveryTimeMinutes: 25,
    deliveryFee: 0,
    priceLevel: 2,
    location: { area: 'Jayanagar', city: 'Bengaluru', landmark: '4th Block' },
    isOpen: true,
    isAcceptingOrders: true,
    isFeatured: true,
    menu: [
      {
        id: 'ss-1',
        name: 'Classic Smash Burger',
        description:
          'Double smashed beef, American cheese, pickles and house sauce in a brioche bun.',
        price: 32900,
        imageUrl: '/dishes/classic-smash-burger.jpg',
        category: 'Burgers',
        isVeg: false,
        isAvailable: true,
        rating: 4.7,
        ratingCount: 1104,
        sortOrder: 1,
      },
      {
        id: 'ss-2',
        name: 'Crispy Chicken Burger',
        description: 'Buttermilk-brined fried chicken, slaw and chipotle mayo.',
        price: 31900,
        imageUrl: '/dishes/crispy-chicken-burger.jpg',
        category: 'Burgers',
        isVeg: false,
        isAvailable: true,
        rating: 4.5,
        ratingCount: 742,
        sortOrder: 2,
      },
      {
        id: 'ss-3',
        name: 'Mushroom Swiss Burger',
        description: 'Griddled mushrooms, melted Swiss and truffle aioli. Vegetarian.',
        price: 29900,
        imageUrl: '/dishes/mushroom-swiss-burger.jpg',
        category: 'Burgers',
        isVeg: true,
        isAvailable: true,
        rating: 4.4,
        ratingCount: 389,
        sortOrder: 3,
      },
      {
        id: 'ss-4',
        name: 'Loaded Cheese Fries',
        description: 'Skin-on fries, molten cheese sauce, jalapeños and spring onion.',
        price: 24900,
        imageUrl: '/dishes/loaded-cheese-fries.jpg',
        category: 'Sides',
        isVeg: true,
        isAvailable: true,
        rating: 4.6,
        ratingCount: 512,
        sortOrder: 4,
      },
    ],
  },

  {
    id: 'kadak-cafe',
    name: 'Kadak Cafe',
    description:
      'South Indian filter coffee, crisp dosas and idlis batter fermented the traditional way.',
    cuisines: ['South Indian', 'Dosa', 'Coffee'],
    imageUrl: '/dishes/cover-south-indian.jpg',
    coverImageUrl: '/dishes/cover-south-indian.jpg',
    rating: 4.2,
    ratingCount: 1544,
    deliveryTimeMinutes: 22,
    deliveryFee: 1900,
    priceLevel: 1,
    location: { area: 'Malleshwaram', city: 'Bengaluru', landmark: '8th Cross' },
    isOpen: false,
    isAcceptingOrders: false,
    isFeatured: false,
    menu: [
      {
        id: 'kc-1',
        name: 'Masala Dosa',
        description: 'Crisp rice and urad dosa with potato palya, coconut chutney and sambar.',
        price: 15900,
        imageUrl: '/dishes/masala-dosa.jpg',
        category: 'Dosas',
        isVeg: true,
        isAvailable: true,
        rating: 4.4,
        ratingCount: 623,
        sortOrder: 1,
      },
      {
        id: 'kc-2',
        name: 'Ghee Roast Dosa',
        description: 'Paper-thin dosa brushed with cow ghee and served with podi chutney.',
        price: 19900,
        imageUrl: '/dishes/ghee-roast-dosa.jpg',
        category: 'Dosas',
        isVeg: true,
        isAvailable: true,
        rating: 4.6,
        ratingCount: 411,
        sortOrder: 2,
      },
      {
        id: 'kc-3',
        name: 'Idli Vada Combo',
        description: 'Two steamed idlis and a golden medu vada with chutney and sambar.',
        price: 13900,
        imageUrl: '/dishes/idli-vada-combo.jpg',
        category: 'Tiffin',
        isVeg: true,
        isAvailable: true,
        rating: 4.3,
        ratingCount: 289,
        sortOrder: 3,
      },
      {
        id: 'kc-4',
        name: 'Filter Coffee',
        description: 'Classic decoction and boiled milk poured between tumbler and davara.',
        price: 5900,
        imageUrl: '/dishes/filter-coffee.svg',
        category: 'Beverages',
        isVeg: true,
        isAvailable: true,
        rating: 4.7,
        ratingCount: 802,
        sortOrder: 4,
      },
    ],
  },

  {
    id: 'green-bowl',
    name: 'Green Bowl',
    description:
      'Grain bowls, salads and cold-press juice. Mostly plant-based, with a few protein add-ons.',
    cuisines: ['Healthy', 'Vegan', 'Salads'],
    imageUrl: '/dishes/cover-healthy-bowl.jpg',
    coverImageUrl: '/dishes/cover-healthy-bowl.jpg',
    rating: 4.4,
    ratingCount: 612,
    deliveryTimeMinutes: 30,
    deliveryFee: 0,
    priceLevel: 2,
    location: { area: 'Bellandur', city: 'Bengaluru', landmark: 'Ecospace' },
    isOpen: true,
    isAcceptingOrders: true,
    isFeatured: true,
    menu: [
      {
        id: 'gb-1',
        name: 'Quinoa Rainbow Bowl',
        description:
          'Quinoa, roasted pumpkin, avocado, chickpeas, feta and a lemon tahini dressing.',
        price: 38900,
        imageUrl: '/dishes/quinoa-rainbow-bowl.jpg',
        category: 'Bowls',
        isVeg: true,
        isAvailable: true,
        rating: 4.6,
        ratingCount: 288,
        sortOrder: 1,
      },
      {
        id: 'gb-2',
        name: 'Grilled Chicken Caesar',
        description: 'Romaine, shaved parmesan, croutons and grilled chicken breast.',
        price: 42900,
        imageUrl: '/dishes/grilled-chicken-caesar.jpg',
        category: 'Salads',
        isVeg: false,
        isAvailable: true,
        rating: 4.5,
        ratingCount: 194,
        sortOrder: 2,
      },
      {
        id: 'gb-3',
        name: 'Cold-Press Green Juice',
        description: 'Spinach, cucumber, green apple, ginger and lemon. No added sugar.',
        price: 22900,
        imageUrl: '/dishes/cold-press-green-juice.jpg',
        category: 'Juices',
        isVeg: true,
        isAvailable: true,
        rating: 4.3,
        ratingCount: 121,
        sortOrder: 3,
      },
    ],
  },
];
