import { Platform } from 'react-native';
import { auditVisibleBackgrounds } from './auditVisibleBackgrounds';

declare global {
  interface Window {
    __CARE_AUDIT_BACKGROUNDS__?: typeof auditVisibleBackgrounds;
  }
}

if (typeof __DEV__ !== 'undefined' && __DEV__ && Platform.OS === 'web' && typeof window !== 'undefined') {
  window.__CARE_AUDIT_BACKGROUNDS__ = auditVisibleBackgrounds;
}
