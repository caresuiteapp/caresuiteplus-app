import { Platform } from 'react-native';
import { CARESUITE_FONT_STACK, CARESUITE_NATIVE_FONT_FAMILY } from './fontFamily';

export const careSuiteAppFontFamily =
  Platform.OS === 'web' ? CARESUITE_FONT_STACK : CARESUITE_NATIVE_FONT_FAMILY;
