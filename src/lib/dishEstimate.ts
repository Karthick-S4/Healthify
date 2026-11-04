export type DishEstimate = {
  name: string;
  kcalPer100g: number;
  servingGrams: number;
  detail: string;
};

type Ingredient = { name: string; kcal: number; words: string[] };
type Method = { label: string; words: string[]; weight: number; oil: number; extra: number; serving: number };

const INGREDIENTS: Ingredient[] = [
  { name: 'potato', kcal: 77, words: ['potato', 'potatoes', 'aloo', 'alu', 'urulai', 'urulaikizhangu', 'urulaikilangu', 'batata', 'bangaladumpa'] },
  { name: 'sweet potato', kcal: 86, words: ['sweet potato', 'shakarkand', 'sakkaravalli', 'sakkaravalli kizhangu'] },
  { name: 'raw banana', kcal: 89, words: ['raw banana', 'plantain', 'vazhakkai', 'kacha kela', 'aratikaya'] },
  { name: 'yam', kcal: 118, words: ['yam', 'senai', 'senai kizhangu', 'suran', 'chena', 'elephant yam'] },
  { name: 'colocasia', kcal: 112, words: ['colocasia', 'arbi', 'seppankizhangu', 'seppankilangu', 'taro', 'chamadumpa'] },
  { name: 'brinjal', kcal: 25, words: ['brinjal', 'baingan', 'eggplant', 'aubergine', 'kathirikai', 'kathrikai', 'vankaya'] },
  { name: 'okra', kcal: 33, words: ['okra', 'bhindi', 'ladies finger', 'ladys finger', 'lady finger', 'vendakkai', 'vendaikai', 'bendakaya'] },
  { name: 'cabbage', kcal: 25, words: ['cabbage', 'muttaikose', 'muttaikos', 'patta gobhi', 'patta gobi', 'band gobhi'] },
  { name: 'cauliflower', kcal: 25, words: ['cauliflower', 'gobi', 'gobhi', 'phool gobhi', 'phool gobi'] },
  { name: 'carrot', kcal: 41, words: ['carrot', 'carrots', 'gajar'] },
  { name: 'beans', kcal: 31, words: ['beans', 'green beans', 'french beans'] },
  { name: 'cluster beans', kcal: 33, words: ['cluster beans', 'kothavarangai', 'gawar', 'guar'] },
  { name: 'beetroot', kcal: 43, words: ['beetroot', 'beet'] },
  { name: 'spinach', kcal: 23, words: ['spinach', 'palak', 'keerai', 'cheera', 'greens'] },
  { name: 'capsicum', kcal: 20, words: ['capsicum', 'bell pepper', 'shimla mirch'] },
  { name: 'mushroom', kcal: 22, words: ['mushroom', 'mushrooms', 'kaalan', 'khumb'] },
  { name: 'peas', kcal: 81, words: ['peas', 'green peas', 'matar', 'mutter', 'pattani'] },
  { name: 'bitter gourd', kcal: 17, words: ['bitter gourd', 'karela', 'pavakkai', 'pavakai', 'kakarakaya'] },
  { name: 'bottle gourd', kcal: 14, words: ['bottle gourd', 'lauki', 'sorakkai', 'surakkai', 'dudhi', 'anapakaya'] },
  { name: 'ridge gourd', kcal: 20, words: ['ridge gourd', 'peerkangai', 'turai', 'beerakaya'] },
  { name: 'snake gourd', kcal: 18, words: ['snake gourd', 'pudalangai', 'padwal'] },
  { name: 'ivy gourd', kcal: 18, words: ['ivy gourd', 'tindora', 'kovakkai', 'kovakai', 'dondakaya'] },
  { name: 'drumstick', kcal: 37, words: ['drumstick', 'murungakkai', 'moringa'] },
  { name: 'pumpkin', kcal: 26, words: ['pumpkin', 'kaddu', 'parangikai', 'poosanikai'] },
  { name: 'jackfruit', kcal: 95, words: ['jackfruit', 'chakka', 'kathal', 'palakkai'] },
  { name: 'corn', kcal: 86, words: ['corn', 'sweet corn', 'makka', 'bhutta'] },
  { name: 'mixed vegetables', kcal: 45, words: ['mixed veg', 'mixed vegetable', 'mixed vegetables', 'vegetable', 'veg'] },
  { name: 'paneer', kcal: 265, words: ['paneer', 'cottage cheese'] },
  { name: 'tofu', kcal: 76, words: ['tofu'] },
  { name: 'soya chunks', kcal: 110, words: ['soya', 'soya chunks', 'meal maker'] },
  { name: 'chickpeas', kcal: 164, words: ['chickpea', 'chickpeas', 'chana', 'chole', 'kondakadalai', 'sundal'] },
  { name: 'kidney beans', kcal: 127, words: ['kidney beans', 'rajma'] },
  { name: 'egg', kcal: 143, words: ['egg', 'eggs', 'muttai', 'anda', 'kodi guddu'] },
  { name: 'chicken', kcal: 150, words: ['chicken', 'kozhi', 'murgh', 'murg', 'kodi'] },
  { name: 'mutton', kcal: 180, words: ['mutton', 'goat', 'lamb', 'aattu kari', 'gosht'] },
  { name: 'fish', kcal: 120, words: ['fish', 'meen', 'machli', 'macchi', 'chepa'] },
  { name: 'prawns', kcal: 85, words: ['prawn', 'prawns', 'shrimp', 'eral', 'jhinga', 'royyalu'] },
  { name: 'crab', kcal: 90, words: ['crab', 'nandu'] },
];

const METHODS: Method[] = [
  {
    label: 'deep fried',
    words: ['deep fry', 'deep fried', 'french fries', 'fries', 'chips', 'finger chips', 'pakora', 'pakoda', 'bajji', 'bhajji', 'bonda', 'fritters', 'crispy', 'tempura', '65'],
    weight: 1.5,
    oil: 16,
    extra: 25,
    serving: 100,
  },
  {
    label: 'a dry fry',
    words: ['fry', 'fried', 'roast', 'roasted', 'poriyal', 'porial', 'varuval', 'varuthathu', 'stir fry', 'sabzi', 'sabji', 'subzi', 'thoran', 'upkari', 'bhujia', 'sukka', 'chukka', 'pepper fry', 'tawa', 'masiyal', 'podimas', 'kosha', 'dry'],
    weight: 1.1,
    oil: 7,
    extra: 0,
    serving: 100,
  },
  {
    label: 'a curry',
    words: ['curry', 'gravy', 'kuzhambu', 'kulambu', 'masala', 'kurma', 'korma', 'kootu', 'stew', 'salna', 'makhani', 'kadai', 'kadhai', 'do pyaza', 'pulusu', 'gassi', 'butter masala', 'ghee roast', 'tikka masala'],
    weight: 0.8,
    oil: 5,
    extra: 12,
    serving: 150,
  },
  {
    label: 'boiled or steamed',
    words: ['boiled', 'steamed', 'mashed', 'salad', 'raw', 'baked', 'grilled', 'tandoori', 'tikka'],
    weight: 1,
    oil: 1,
    extra: 0,
    serving: 100,
  },
];

function clean(value: string): string {
  return ` ${value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()} `;
}

function longestWord<T extends { words: string[] }>(text: string, items: T[]): { item: T; word: string } | null {
  let best: { item: T; word: string } | null = null;
  for (const item of items) {
    for (const word of item.words) {
      if (text.includes(` ${word} `) && (!best || word.length > best.word.length)) best = { item, word };
    }
  }
  return best;
}

export function ingredientVariants(query: string): string[] {
  const text = clean(query);
  const found = longestWord(text, INGREDIENTS);
  if (!found) return [];
  const others = found.item.words.filter((word) => word !== found.word && !word.includes(' ')).slice(0, 4);
  return others.map((word) => text.replace(` ${found.word} `, ` ${word} `).trim());
}

export function estimateDish(query: string): DishEstimate | null {
  const text = clean(query);
  const ingredient = longestWord(text, INGREDIENTS);
  if (!ingredient) return null;
  const method = longestWord(text.replace(` ${ingredient.word} `, ' '), METHODS);
  if (!method) return null;
  const { item: food } = ingredient;
  const { item: style } = method;
  const kcal = Math.round(food.kcal * style.weight + style.oil * 9 + style.extra);
  return {
    name: query.trim().replace(/\b[a-z]/g, (letter) => letter.toUpperCase()),
    kcalPer100g: kcal,
    servingGrams: style.serving,
    detail: `Healthify’s estimate for ${food.name} cooked as ${style.label}, with about ${style.oil} g of oil per 100 g`,
  };
}
