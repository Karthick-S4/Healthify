export const MEASURE_PARTS = ['Neck', 'Shoulder', 'Bust', 'Upper waist', 'Waist', 'Lower belly', 'Hips', 'Arms', 'Thigh', 'Calf'];

export function measureRank(part: string): number {
  const index = MEASURE_PARTS.findIndex((name) => name.toLocaleLowerCase() === part.toLocaleLowerCase());
  return index === -1 ? MEASURE_PARTS.length : index;
}
