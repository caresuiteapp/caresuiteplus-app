import {useCallback,useEffect,useRef} from 'react';
import {useNavigation} from 'expo-router';
import {usePreventRemove} from '@/hooks/useNativePreventRemove.native';
import {confirmNativeWorkspaceAction} from '@/lib/platform/nativeWorkspaceActions.native';
export function useUnsavedWebChanges(dirty:boolean,busy=false,message='Ihre Eingaben sind noch nicht gespeichert. Möchten Sie die Bearbeitung verwerfen und die Seite verlassen?'){
  const navigation=useNavigation(),confirming=useRef(false),alive=useRef(true);useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  const confirmLeave=useCallback(async()=>{if(busy||confirming.current)return false;if(!dirty)return true;confirming.current=true;try{const accepted=await confirmNativeWorkspaceAction(message);return alive.current&&accepted;}finally{confirming.current=false;}},[busy,dirty,message]);
  usePreventRemove(dirty||busy,({data})=>{void confirmLeave().then(accepted=>{if(accepted&&alive.current)navigation.dispatch(data.action);});});return confirmLeave;
}
