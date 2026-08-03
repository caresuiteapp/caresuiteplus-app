import { Platform, type ViewStyle } from 'react-native';
import { portalPremium } from '@/design/tokens/portalPremium';

/** Opaque light surfaces for employee visit execution — readable on mobile portal. */
export const employeePortalExecutionSurface = {
  background: portalPremium.surfaceRaised,
  subtleBackground: portalPremium.surfaceSoft,
  border: portalPremium.borderSoft,
  borderStrong: portalPremium.borderStrong,
  inputBackground: portalPremium.surfaceRaised,
} as const;

export const employeePortalExecutionText = portalPremium.text;

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
