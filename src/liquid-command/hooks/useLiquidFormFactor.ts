import { Platform, useWindowDimensions } from 'react-native';
import type { LiquidFormFactor } from '../types';

export function useLiquidFormFactor(): LiquidFormFactor {
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const shortest = Math.min(width, height);
  const phone = shortest < 600;

  if (phone && landscape && Platform.OS !== 'web') {
    return 'phone-landscape-blocked';
  }
  if (phone) {
    return 'phone-portrait';
  }
  if (Platform.OS === 'web' && width >= 1280) {
    return 'desktop';
  }
  return landscape ? 'tablet-landscape' : 'tablet-portrait';
}

