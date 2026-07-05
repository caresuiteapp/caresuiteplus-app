import { Platform, type ViewStyle } from 'react-native';
import { lightSurfaceText } from '@/design/tokens/auroraGlass';
import { careLightColors } from '@/design/tokens/lightTheme';

/** Opaque light surfaces for employee visit execution — readable on mobile portal. */
export const employeePortalExecutionSurface = {
  background: careLightColors.surface,
  subtleBackground: careLightColors.page,
  border: careLightColors.border,
  borderStrong: careLightColors.borderStrong,
  inputBackground: careLightColors.page,
} as const;

export const employeePortalExecutionText = lightSurfaceText;

export const employeePortalExecutionShadow: ViewStyle = Platform.select({
  web: { boxShadow: '0 2px 12px rgba(7,18,42,0.08)' } as ViewStyle,
  default: {
    shadowColor: 'rgba(7,18,42,0.12)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
}) ?? {};
