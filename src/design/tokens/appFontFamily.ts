import { Platform } from 'react-native';
import { CARESUITE_FONT_STACK } from './fontFamily';

/**
 * Web/Desktop uses the installed Century Gothic family. Native registration
 * must follow when licensed app font assets are supplied; an unregistered
 * family name would silently fall back to the platform font.
 */
export const careSuiteAppFontFamily =
  Platform.OS === 'web' ? CARESUITE_FONT_STACK : undefined;
