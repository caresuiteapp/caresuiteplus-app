import { Platform } from 'react-native';
import { auditVisibleBackgrounds } from './auditVisibleBackgrounds';

declare global {
  interface Window {
    __CARE_AUDIT_BACKGROUNDS__?: typeof auditVisibleBackgrounds;
  }
}

if (typeof __DEV__ !== 'undefined' && __DEV__ && Platform.OS === 'web' && typeof window !== 'undefined') {
  window.__CARE_AUDIT_BACKGROUNDS__ = auditVisibleBackgrounds;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { LogBox } = require('react-native') as typeof import('react-native');
    LogBox.ignoreLogs([/INTAKE_NEW_ROUTE/i, /CLIENT_INTAKE_NEW_ROUTE/i]);
  } catch {
    // LogBox unavailable outside RN runtime
  }
}
