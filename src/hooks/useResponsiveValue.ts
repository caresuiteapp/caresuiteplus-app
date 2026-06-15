import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import {
  type ResponsiveValueMap,
  resolveResponsiveValue,
} from '@/design/tokens/responsiveValue';

export type { ResponsiveValueMap } from '@/design/tokens/responsiveValue';
export { resolveResponsiveValue } from '@/design/tokens/responsiveValue';

export function useResponsiveValue<T>(values: ResponsiveValueMap<T>): T {
  const { width } = useWindowDimensions();
  return useMemo(() => resolveResponsiveValue(width, values), [values, width]);
}
