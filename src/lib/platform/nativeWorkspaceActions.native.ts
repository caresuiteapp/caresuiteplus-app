import {Alert} from 'react-native';
import {confirmAction} from './confirmAction';
export function confirmNativeWorkspaceAction(message:string):Promise<boolean>{return confirmAction({title:'Bitte bestätigen',message,confirmLabel:'Bestätigen',cancelLabel:'Abbrechen'});}
class CancelledEffect extends Error{}
export function runNativeWorkspaceEffect(effect:(confirm:typeof confirmNativeWorkspaceAction)=>Promise<void|(()=>void)>){let active=true,cleanup:(()=>void)|undefined;void effect(async message=>{const accepted=await confirmNativeWorkspaceAction(message);if(!active)throw new CancelledEffect();return accepted;}).then(result=>{if(typeof result==='function'){if(active)cleanup=result;else result();}}).catch(error=>{if(active&&!(error instanceof CancelledEffect))Alert.alert('Aktion nicht abgeschlossen',error instanceof Error?error.message:'Bitte erneut versuchen.');});return()=>{active=false;cleanup?.();};}
