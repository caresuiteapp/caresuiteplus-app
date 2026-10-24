import {useRouter} from 'expo-router';
import {useAuth} from '@/lib/auth/context';
import {resolveAuthSessionTarget} from '@/lib/auth/sessionTarget';
export function webNavigationScope(auth:ReturnType<typeof useAuth>){return JSON.stringify([auth.user?.id,auth.profile?.id,auth.profile?.tenantId,auth.profile?.roleKey,auth.portalSession?.accountId]);}
export function useWebBackNavigation(fallback?:string){const router=useRouter(),auth=useAuth();return()=>{if(router.canGoBack())router.back();else router.replace((fallback??(auth.isAuthenticated?resolveAuthSessionTarget(auth).homePath:'/')) as never);};}
