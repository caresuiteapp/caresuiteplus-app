import {forwardRef} from 'react';
import {Text,TextInput,type TextProps,type TextInputProps} from 'react-native';
import {careSuiteAppFontFamily} from '@/design/tokens/appFontFamily';
export type CareSuiteNativeText=Text;
export type CareSuiteNativeTextInput=TextInput;
export const CareSuiteNativeText=forwardRef<Text,TextProps>((props,ref)=><Text {...props} ref={ref} style={[{fontFamily:careSuiteAppFontFamily},props.style]}/>);
export const CareSuiteNativeTextInput=forwardRef<TextInput,TextInputProps>((props,ref)=><TextInput {...props} ref={ref} style={[{fontFamily:careSuiteAppFontFamily},props.style]}/>);
