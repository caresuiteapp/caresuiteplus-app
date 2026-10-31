import {useEffect} from 'react';
import {AppState} from 'react-native';
import {AssistLiveMap} from './AssistLiveMap.native';
import type {AssistLiveMapProps} from './AssistLiveMap';
export type GoogleMapsLiveMapProps=Omit<AssistLiveMapProps,'position'>&{position?:AssistLiveMapProps['position'];appearance?:'default'|'light';showMeta?:boolean;showControls?:boolean;onVisiblePoll?:()=>void};
export function GoogleMapsLiveMap({onVisiblePoll,appearance:_appearance,showMeta:_meta,showControls:_controls,...props}:GoogleMapsLiveMapProps){useEffect(()=>{if(!onVisiblePoll)return;onVisiblePoll();const subscription=AppState.addEventListener('change',state=>{if(state==='active')onVisiblePoll();});return()=>subscription.remove();},[onVisiblePoll]);return <AssistLiveMap {...props} position={props.position??null}/>;}
