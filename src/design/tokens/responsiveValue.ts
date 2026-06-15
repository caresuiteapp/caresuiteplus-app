import { type AdaptiveDeviceClass, resolveAdaptiveDeviceClass } from './breakpoints';

export type ResponsiveValueMap<T> = Partial<Record<AdaptiveDeviceClass, T>> & {
  phone: T;
};

export function resolveResponsiveValue<T>(width: number, values: ResponsiveValueMap<T>): T {
  const deviceClass = resolveAdaptiveDeviceClass(width);
  return values[deviceClass] ?? values.phone;
}
