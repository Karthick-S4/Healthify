export type FoodGroup = 'Breakfast' | 'Mains' | 'Sides' | 'Fruit' | 'Snacks' | 'Drinks' | 'Yours';

export type Food = {
  id: string;
  name: string;
  group: FoodGroup;
  aliases: string[];
  kcalPer100g: number;
  pieceGrams: number;
  pieceLabel: string;
  bowlGrams?: number;
  cupGrams?: number;
  plateGrams?: number;
  source: 'built-in' | 'custom';
};

export type LogEntry = {
  id: string;
  date: string;
  title: string;
  grams: number;
  kcal: number;
  outside: boolean;
  foodId?: string;
  createdAt: string;
};

export type CustomRange = {
  start: string;
  end: string;
  budget: number;
};

export type Profile = {
  dailyTarget: number;
  weekBudget: number | null;
  monthBudget: number | null;
  custom: CustomRange | null;
};

export type FoodTweak = {
  kcalPer100g?: number;
  pieceGrams?: number;
};

export type AppData = {
  version: 1;
  pinHash: string | null;
  profile: Profile;
  customFoods: Food[];
  tweaks: Record<string, FoodTweak>;
  dayTargets: Record<string, number>;
  logs: LogEntry[];
  hintDismissed: boolean;
};

export type PeriodKind = 'day' | 'week' | 'month' | 'custom';
