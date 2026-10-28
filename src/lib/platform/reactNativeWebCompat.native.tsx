import {forwardRef} from 'react';
import {View,ScrollView,Pressable,type ViewStyle,type ViewProps,type ScrollViewProps,type PressableProps} from 'react-native';
type DataSet={dataSet?:Record<string,string|number|boolean|null|undefined>};
export type WebView=View;
export const WebView=forwardRef<View,ViewProps&DataSet>(({dataSet:_data,...props},ref)=><View {...props} ref={ref}/>);
export const WebScrollView=forwardRef<ScrollView,ScrollViewProps&DataSet>(({dataSet:_data,...props},ref)=><ScrollView {...props} ref={ref}/>);
export const WebPressable=forwardRef<View,PressableProps&DataSet>(({dataSet:_data,...props},ref)=><Pressable {...props} ref={ref}/>);
export function fixedWebViewStyle(style:Omit<ViewStyle,'position'>&{position:'fixed'}):ViewStyle{return {...style,position:'absolute'};}
