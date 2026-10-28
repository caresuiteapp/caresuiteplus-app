import {useContext,useEffect,useId} from 'react';
import {useIsFocused} from 'expo-router';
import {usePreventRemove as useNavigationPreventRemove} from 'expo-router/react-navigation';
import {NativeWorkflowPageContext} from '@/components/navigation/NativeWorkflowPageContext.shared';
import {nativeWorkflowLifecycle} from '@/lib/platform/nativeWorkflowLifecycle.shared';
export * from 'expo-router/react-navigation';
/** One focused form guard owns the question when a page also protects local drafts. */
export function usePreventRemove(blocked:boolean,callback:Parameters<typeof useNavigationPreventRemove>[1]){
  const owner=useContext(NativeWorkflowPageContext),key=useId(),focused=useIsFocused();
  useEffect(()=>{nativeWorkflowLifecycle.setDedicatedGuard(owner,key,focused&&blocked);return()=>nativeWorkflowLifecycle.setDedicatedGuard(owner,key,false);},[owner,key,focused,blocked]);
  useNavigationPreventRemove(focused&&blocked,callback);
}
