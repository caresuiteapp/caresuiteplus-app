import {useCallback,useEffect,useRef} from 'react';
import {useIsFocused,useNavigation,usePathname} from 'expo-router';
import {usePreventRemove} from 'expo-router/react-navigation';
import {confirmNativeWorkspaceAction} from '@/lib/platform/nativeWorkspaceActions.native';
/** Keep the active native form mounted until saving finishes or discard is confirmed. */
export function useNativeUnsavedChanges(dirty:boolean,busy:boolean,message:string){
  const navigation=useNavigation(),pathname=usePathname(),focused=useIsFocused(),current=useRef({dirty,busy}),allowed=useRef(false),confirming=useRef(false),alive=useRef(true);current.current={dirty,busy};
  useEffect(()=>{allowed.current=false;},[dirty,pathname]);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  const confirmLeave=useCallback(async()=>{if(current.current.busy||confirming.current)return false;if(allowed.current)return true;if(!current.current.dirty){allowed.current=true;return true;}confirming.current=true;try{const accepted=await confirmNativeWorkspaceAction(message);if(!alive.current||current.current.busy)return false;if(accepted)allowed.current=true;return accepted;}finally{confirming.current=false;}},[message]);
  usePreventRemove(focused&&(dirty||busy),({data})=>{void confirmLeave().then(accepted=>{if(accepted&&alive.current){allowed.current=false;navigation.dispatch(data.action);}});});
  const releaseAfterConfirmation=useCallback(()=>{allowed.current=true;},[]),restoreProtection=useCallback(()=>{allowed.current=false;},[]);
  return {confirmLeave,releaseAfterConfirmation,restoreProtection};
}
