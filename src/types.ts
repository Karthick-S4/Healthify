export type FoodGroup = 'Breakfast' | 'Mains' | 'Sides' | 'Fruit' | 'Snacks' | 'Drinks' | 'Yours';

export type Food = {
  id: string;
  name: string;
  group: FoodGroup;
  aliases: string[];
  kcalPer100g: number;
  proteinPer100g?: number;
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

export type WeightEntry = {
  id: string;
  date: string;
  kg: number;
  createdAt: string;
};

export type MeasureEntry = {
  id: string;
  date: string;
  part: string;
  cm: number;
  createdAt: string;
};

export type ActivityEntry = {
  id: string;
  date: string;
  name: string;
  minutes: number;
  createdAt: string;
};

export type TargetPlan = {
  from: string;
  daily: number;
  week: number | null;
  month: number | null;
};

export type CustomRange = {
  id: string;
  start: string;
  end: string;
  daily: number | null;
  week: number | null;
};

export type Profile = {
  dailyTarget: number;
  goalSet: boolean;
  weekBudget: number | null;
  monthBudget: number | null;
  plans: TargetPlan[];
  ranges: CustomRange[];
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
  weights: WeightEntry[];
  measures: MeasureEntry[];
  activities: ActivityEntry[];
  removedLogIds: string[];
  removedFoodIds: string[];
  removedTweakIds: string[];
  hintDismissed: boolean;
};

export type ProfileRecord = {
  id: string;
  name: string;
  updatedAt: string;
  data: AppData;
};

export type ProfileBook = {
  version: 1;
  updatedAt: string;
  profiles: ProfileRecord[];
  removedProfileIds: string[];
};

export type PeriodKind = 'day' | 'week' | 'month' | 'custom';
