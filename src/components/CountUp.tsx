import { formatKcal } from '../lib/format';
import { useCountUp } from './useCountUp';

export function CountUp({ value, format = formatKcal, duration }: { value: number; format?: (value: number) => string; duration?: number }) {
  return <>{format(useCountUp(value, duration))}</>;
}
