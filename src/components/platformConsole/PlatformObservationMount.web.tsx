import { useEffect } from 'react';
import { usePathname } from 'expo-router';
import { getSupabaseClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth';
import { useWebStartDestination } from '@/components/brand/WebStartDestination.web';
import { isObservationCollectionReady,observeHeartbeat,recordObservedError,setObservationAccessToken,setObservationCollectionEnabled,setObservationPage } from '@/lib/platformConsole/platformObservation.web';

/** Lifecycle-scoped Web/Desktop observation. It never blocks navigation or authentication. */
export function PlatformObservationMount() {
  const pathname=usePathname();
  const {user,authReady}=useAuth();
  const {showChoice}=useWebStartDestination();
  useEffect(()=>{
    let alive=true;let loading=false;
    async function check(){
      if(loading||document.visibilityState==='hidden')return;
      loading=true;
      const ready=await isObservationCollectionReady();
      loading=false;
      if(alive){setObservationCollectionEnabled(ready);if(ready)void observeHeartbeat();}
    }
    void check();
    const timer=setInterval(()=>void check(),60_000);
    const visible=()=>{if(document.visibilityState==='visible')void check();};
    document.addEventListener('visibilitychange',visible);
    return()=>{alive=false;clearInterval(timer);document.removeEventListener('visibilitychange',visible);setObservationCollectionEnabled(false);};
  },[]);
  useEffect(()=>{
    const client=getSupabaseClient();
    if(!client)return;
    let alive=true;let authChanged=false;
    const subscription=client.auth.onAuthStateChange((_event,session)=>{
      authChanged=true;setObservationAccessToken(session?.access_token??null);
      void observeHeartbeat();
    });
    void client.auth.getSession().then(({data})=>{
      if(alive&&!authChanged){setObservationAccessToken(data.session?.access_token??null);void observeHeartbeat();}
    }).catch(()=>undefined);
    return()=>{alive=false;subscription.data.subscription.unsubscribe();setObservationAccessToken(null);};
  },[]);
  useEffect(()=>{
    setObservationPage(pathname,Boolean(user)&&!showChoice);
    void observeHeartbeat();
  },[pathname,user?.id,authReady,showChoice]);
  useEffect(()=>{
    const visibility=()=>void observeHeartbeat(document.visibilityState==='visible');
    const hide=()=>void observeHeartbeat(false);
    const error=()=>recordObservedError('render','page');
    const rejection=()=>recordObservedError('unexpected','page');
    const timer=setInterval(()=>{if(document.visibilityState==='visible')void observeHeartbeat();},30_000);
    document.addEventListener('visibilitychange',visibility);
    window.addEventListener('pagehide',hide);
    window.addEventListener('pageshow',visibility);
    window.addEventListener('error',error);
    window.addEventListener('unhandledrejection',rejection);
    return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pagehide',hide);
      window.removeEventListener('pageshow',visibility);window.removeEventListener('error',error);window.removeEventListener('unhandledrejection',rejection);};
  },[]);
  return null;
}
