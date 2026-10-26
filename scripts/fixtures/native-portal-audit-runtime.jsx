import React,{createContext,useContext,useSyncExternalStore} from 'react';
import {View,Text,Pressable} from 'react-native';
export {DefaultTheme} from 'expo-router/build/react-navigation/native/theming/DefaultTheme.js';
export {DarkTheme} from 'expo-router/build/react-navigation/native/theming/DarkTheme.js';
export {ThemeProvider} from 'expo-router/build/react-navigation/core/theming/ThemeProvider.js';

const Depth=createContext(0),listeners=new Set();
const events=()=>window.__nativePortalAuditEvents??(window.__nativePortalAuditEvents=[]);
const query=()=>new URLSearchParams(location.search);
export function readPortalAuditCase(){const id=query().get('screen');const selected=window.__nativePortalAuditCases?.[id];if(!selected)throw Error('Unregistered actual portal route case: '+id);return {id,...selected,state:query().get('state')??'ready',role:query().get('role')};}
export function recordPortalAuditEvent(type,detail={}){events().push({type,...detail});}
const subscribe=callback=>{listeners.add(callback);return()=>listeners.delete(callback);};
const snapshot=()=>location.search;
export function useAuditLocation(){return useSyncExternalStore(subscribe,snapshot,snapshot);}
export function usePathname(){useAuditLocation();return (query().get('route')??readPortalAuditCase().href).split(/[?#]/)[0];}
export function useLocalSearchParams(){
  useAuditLocation();const value=readPortalAuditCase(),href=query().get('route')??value.href,path=href.split(/[?#]/)[0].split('/'),template=value.routeTemplate?.split('/')??[],params=Object.fromEntries(new URLSearchParams(href.split('?')[1]?.split('#')[0]??''));
  template.forEach((part,index)=>{if(/^\[[^.[\]]+\]$/.test(part)&&path[index])params[part.slice(1,-1)]=decodeURIComponent(path[index]);});
  return params;
}
export const useGlobalSearchParams=useLocalSearchParams;
const history=[];
function targetHref(target){if(typeof target==='string')return target;const params=new URLSearchParams();for(const [name,value]of Object.entries(target.params??{}))for(const entry of Array.isArray(value)?value:[value])if(entry!==undefined&&entry!==null)params.append(name,String(entry));return target.pathname+(params.size?'?'+params:'');}
function navigate(target,kind){
  const href=targetHref(target),path=href.split(/[?#]/)[0],registry=window.__nativePortalAuditCases??{},found=Object.entries(registry).find(([,entry])=>entry.href.split(/[?#]/)[0]===path)||Object.entries(registry).find(([,entry])=>entry.routeTemplate&&new RegExp('^'+entry.routeTemplate.replace(/[.*+?^${}()|\\]/g,'\\$&').replace(/\[([^\]]+)\]/g,'[^/]+')+'$').test(path));
  recordPortalAuditEvent('navigate',{kind,href,receivingCase:found?.[0]??null});
  if(!found)return;
  if(kind==='push')history.push(location.search);
  const next=new URLSearchParams(location.search);next.set('screen',found[0]);next.set('route',href);window.history.replaceState({},'',location.pathname+'?'+next);listeners.forEach(callback=>callback());
}
const router={push:target=>navigate(target,'push'),replace:target=>navigate(target,'replace'),navigate:target=>navigate(target,'navigate'),canGoBack:()=>history.length>0,back:()=>{const previous=history.pop();if(previous){window.history.replaceState({},'',location.pathname+previous);listeners.forEach(callback=>callback());}recordPortalAuditEvent('back');},dismissTo:target=>navigate(target,'dismissTo'),dismiss:()=>router.back(),setParams:params=>navigate({pathname:usePathnameOutsideReact(),params:{...Object.fromEntries(new URLSearchParams((query().get('route')??readPortalAuditCase().href).split('?')[1]??'')),...params}},'setParams')};
const usePathnameOutsideReact=()=> (query().get('route')??readPortalAuditCase().href).split(/[?#]/)[0];
export const useRouter=()=>router;
export const useIsFocused=()=>true,useFocusEffect=callback=>React.useEffect(callback,[]),useRootNavigationState=()=>({key:'synthetic-audit-root'});
export const useNavigation=()=>({addListener:()=>()=>{},dispatch:action=>recordPortalAuditEvent('native-navigation-boundary',{action})});
export const useSegments=()=>usePathname().split('/').filter(Boolean);
export const useIsPreview=()=>false;
export function Redirect({href}){React.useEffect(()=>router.replace(href),[typeof href==='string'?href:JSON.stringify(href)]);return null;}
export function Link({href,children,...props}){return <Pressable {...props} accessibilityRole="link" onPress={()=>router.push(href)}>{children}</Pressable>;}
function NextLayer({style,screenLayout}){
  const depth=useContext(Depth),value=readPortalAuditCase(),Layer=window.__nativePortalAuditLayers?.[value.id]?.[depth];
  if(!Layer)throw Error('Missing real ancestor/receiving layer '+depth+' for '+value.id);
  let child=<Layer/>;if(screenLayout)child=React.createElement(screenLayout,{children:child,route:{name:value.href}});
  return <Depth.Provider value={depth+1}><View style={[{flex:1,minWidth:0,minHeight:0},style]} testID={'native-portal-audit-navigator-'+depth}>{child}</View></Depth.Provider>;
}
export function Stack({screenOptions,screenLayout}){const value=readPortalAuditCase(),depth=useContext(Depth),name=value.layerNames?.[depth]??value.href;const options=typeof screenOptions==='function'?screenOptions({route:{name,key:'audit-'+depth}}):screenOptions;return <NextLayer style={options?.contentStyle} screenLayout={screenLayout}/>;}
Stack.Screen=()=>null;export const Tabs=Stack;
export const Slot=()=> <NextLayer/>;
export const ErrorBoundary=({error})=><View accessibilityRole="alert"><Text>{String(error)}</Text></View>;
