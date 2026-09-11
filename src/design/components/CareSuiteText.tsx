import { forwardRef, type ComponentRef } from 'react';
import { Text as NativeText, TextInput as NativeTextInput, type TextProps, type TextInputProps } from 'react-native';
import { careSuiteAppFontFamily } from '../tokens/appFontFamily';

const fontStyle = { fontFamily: careSuiteAppFontFamily };

/** Shared defaults; explicit icon families and caller styles keep precedence. */
export const CareSuiteText = forwardRef<ComponentRef<typeof NativeText>, TextProps>(
  ({ style, ...props }, ref) => <NativeText {...props} ref={ref} style={[fontStyle, style]} />,
);
CareSuiteText.displayName = 'CareSuiteText';

export const CareSuiteTextInput = forwardRef<ComponentRef<typeof NativeTextInput>, TextInputProps>(
  ({ style, ...props }, ref) => <NativeTextInput {...props} ref={ref} style={[fontStyle, style]} />,
);
CareSuiteTextInput.displayName = 'CareSuiteTextInput';
