import { describe, expect, it } from 'vitest';
import { caloriesFromUsda } from './lookupFood';
import { freshData, fromBackup, normalizeBook } from './storage';
import { isPassword, isProfileName } from './password';

const listing = (description: string, kcal: number, dataType = 'Survey (FNDDS)') => ({
  description,
  dataType,
  foodNutrients: [{ nutrientId: 1008, nutrientName: 'Energy', unitName: 'KCAL', value: kcal }],
});

describe('caloriesFromUsda', () => {
  it('uses the chicken listing when the query names chicken', () => {
    const hit = caloriesFromUsda(
      {
        foods: [
          listing('Biryani with vegetables', 109),
          listing('Biryani with chicken', 104),
          listing('Biryani with meat', 145),
        ],
      },
      'chicken biryani',
    );
    expect(hit).toMatchObject({ name: 'Biryani with chicken', kcalPer100g: 104, source: 'USDA FoodData Central' });
  });

  it('averages several plain biryani listings and converts a branded serving', () => {
    const plain = caloriesFromUsda(
      {
        foods: [listing('Biryani with vegetables', 109), listing('Biryani with chicken', 104), listing('Biryani with meat', 145)],
      },
      'biryani',
    );
    expect(plain).toMatchObject({ name: 'biryani', kcalPer100g: 109 });

    const branded = caloriesFromUsda(
      {
        foods: [
          {
            description: 'Maggi masala noodles',
            dataType: 'Branded',
            servingSize: 80,
            servingSizeUnit: 'g',
            foodNutrients: [{ nutrientId: 1008, nutrientName: 'Energy', unitName: 'KCAL', value: 200 }],
          },
        ],
      },
      'maggi masala noodles',
    );
    expect(branded?.kcalPer100g).toBe(250);
  });

  it('ignores a search that does not match the words', () => {
    expect(caloriesFromUsda({ foods: [listing('Apple juice', 46)] }, 'dragon fruit')).toBeNull();
  });
});

describe('profiles', () => {
  it('accepts a named backup and still reads an older pin backup', () => {
    const diary = freshData();
    diary.logs = [
      {
        id: '1',
        date: '2026-11-04',
        title: 'Apple, 150 g',
        grams: 150,
        kcal: 78,
        outside: false,
        createdAt: '2026-11-04T00:00:00.000Z',
      },
    ];
    expect(fromBackup({ version: 2, profileName: 'Priya', diary })?.logs).toHaveLength(1);
    expect(fromBackup({ version: 1, pinHash: 'abc', logs: diary.logs })?.logs).toHaveLength(1);
    expect(fromBackup({ version: 2, diary: { version: 1 } })).toBeNull();
  });

  it('drops a broken profile and checks a name and password', () => {
    expect(normalizeBook({ version: 1, profiles: [{ id: 'x' }, { id: 'ok', name: 'Priya', salt: 'aa', passwordHash: 'bb', data: freshData() }] }).profiles).toHaveLength(1);
    expect(isProfileName('Priya')).toBe(true);
    expect(isProfileName('')).toBe(false);
    expect(isPassword('secret')).toBe(true);
    expect(isPassword('1234')).toBe(false);
  });
});
