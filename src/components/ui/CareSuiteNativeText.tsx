import {forwardRef,useState} from 'react';
import {StyleSheet,Text,TextInput,type LayoutChangeEvent,type TextProps,type TextInputProps} from 'react-native';
import {careSuiteAppFontFamily} from '@/design/tokens/appFontFamily';
import {nativeTextNeedsRadiusLayout,normalizeNativeTextStyle,type NativeTextBounds} from '@/lib/platform/nativeWorkspaceStyles.shared';
export type CareSuiteNativeText=Text;
export type CareSuiteNativeTextInput=TextInput;
function useNativeTextStyle(props:Pick<TextProps,'style'|'onLayout'>){
  const [bounds,setBounds]=useState<NativeTextBounds>();
  const flat=StyleSheet.flatten(props.style)??{},measure=nativeTextNeedsRadiusLayout(flat);
  const onLayout=measure?(event:LayoutChangeEvent)=>{
    const {width,height}=event.nativeEvent.layout;
    // Radius updates do not change layout. Equal measurements must not queue
    // another render, including during native preallocation and font changes.
    setBounds(previous=>previous?.width===width&&previous.height===height?previous:{width,height});
    props.onLayout?.(event);
  }:props.onLayout;
  return {style:[{fontFamily:careSuiteAppFontFamily},normalizeNativeTextStyle(flat,bounds)],onLayout};
}
export const CareSuiteNativeText=forwardRef<Text,TextProps>((props,ref)=>{
  const presentation=useNativeTextStyle(props);
  return <Text {...props} ref={ref} {...presentation}/>;
});
export const CareSuiteNativeTextInput=forwardRef<TextInput,TextInputProps>((props,ref)=>{
  const presentation=useNativeTextStyle(props);
  return <TextInput {...props} ref={ref} {...presentation}/>;
});
