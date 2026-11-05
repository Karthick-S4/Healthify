import { MEAL_LABEL, MEAL_SLOTS } from '../lib/suggestions';
import type { MealSlot } from '../types';

type MealPickerProps = {
  value: MealSlot;
  onChange: (slot: MealSlot) => void;
};

export function MealPicker({ value, onChange }: MealPickerProps) {
  return (
    <div className="meal-picker" role="radiogroup" aria-label="Which meal">
      {MEAL_SLOTS.map((slot) => (
        <button key={slot} type="button" role="radio" aria-checked={value === slot} className={value === slot ? 'on' : undefined} onClick={() => onChange(slot)}>
          {MEAL_LABEL[slot]}
        </button>
      ))}
    </div>
  );
}
