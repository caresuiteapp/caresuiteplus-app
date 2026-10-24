import {useContext,useId,useRef,useSyncExternalStore,type ComponentType} from 'react';
import {Alert} from 'react-native';
import {useIsFocused,useNavigation} from 'expo-router';
import {usePreventRemove} from 'expo-router/react-navigation';
import {confirmAction} from '@/lib/platform/confirmAction';
import {nativeWorkflowLifecycle} from '@/lib/platform/nativeWorkflowLifecycle.shared';
import {NativeWorkflowPageContext} from './NativeWorkflowPageContext.shared';
export {NativeWorkflowPageContext} from './NativeWorkflowPageContext.shared';
function Guard(){const owner=useContext(NativeWorkflowPageContext),focused=useIsFocused(),navigation=useNavigation(),confirming=useRef(false);const count=useSyncExternalStore(nativeWorkflowLifecycle.subscribe,()=>nativeWorkflowLifecycle.count(owner),()=>0);
  usePreventRemove(focused&&count>0,({data})=>{if(confirming.current)return;confirming.current=true;void(async()=>{try{if(nativeWorkflowLifecycle.mayLeave(owner)||await confirmAction({title:'Ungespeicherte Eingaben',message:'Möchten Sie die Bearbeitung verwerfen und die Seite verlassen?',confirmLabel:'Seite verlassen',cancelLabel:'Weiter bearbeiten'}))navigation.dispatch(data.action);}catch{Alert.alert('Bearbeitung bleibt geöffnet','Der Bearbeitungsstand konnte nicht geprüft werden. Bitte die Eingaben sichern und erneut versuchen.');}finally{confirming.current=false;}})();});return null;
}
export function withNativeWorkflowPage<P extends object>(Page:ComponentType<P>):ComponentType<P>{function NativeWorkflowPage(props:P){const owner=useId();return <NativeWorkflowPageContext.Provider value={owner}><Guard/><Page {...props}/></NativeWorkflowPageContext.Provider>;}NativeWorkflowPage.displayName='NativeWorkflowPage('+ (Page.displayName??Page.name??'Page')+')';return NativeWorkflowPage;}
