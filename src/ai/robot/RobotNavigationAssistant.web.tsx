import { useEffect, useRef } from 'react';
import { Image } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { usePermissions } from '@/hooks/usePermissions';
import { fetchClientList } from '@/lib/office/clientListService';
import { CARESUITE_ROBOT_LOGO } from '@/components/brand/brandassets';
import { useAppStartIntroReady } from '@/components/brand/appStartIntroSession';
import { useWebStartChoiceVisible } from '@/components/brand/WebStartDestination.web';
import { isWebDeviceLoginRoute } from '@/lib/navigation/deviceLoginRoute.web';
import { mountRobotAssistant } from './robotAssistantDom';
import { createNeoSpeech } from './neoSpeech.web';
import { neoProfileName } from './neoCommands';
import { getNeoWeather } from './neoWeather.web';
import { matchVoiceClients, type VoiceClient } from './voiceCommands';

function robotAssetUrl(): string {
  const asset: unknown = CARESUITE_ROBOT_LOGO;
  if (typeof asset === 'string') return asset;
  if (asset && typeof asset === 'object') {
    const item = asset as { uri?: string; default?: string };
    if (typeof item.uri === 'string') return item.uri;
    if (typeof item.default === 'string') return item.default;
  }
  // Mirrors CareSuite's existing web asset handling; this method is absent in RN Web.
  return typeof Image.resolveAssetSource === 'function' ? Image.resolveAssetSource(CARESUITE_ROBOT_LOGO)?.uri ?? '' : '';
}

export function RobotNavigationAssistant() {
  const startupReady = useAppStartIntroReady();
  const choosingDestination = useWebStartChoiceVisible();
  const { authReady, isAuthenticated, profile, user } = useAuth();
  const tenantId = useServiceTenantId();
  const pathname = usePathname();
  const router = useRouter();
  const { can, hasModuleGate } = usePermissions();
  const current = useRef({ router, can, hasModuleGate, profileName: neoProfileName(profile, user) });
  current.current = { router, can, hasModuleGate, profileName: neoProfileName(profile, user) };
  const role = profile?.roleKey;
  const userId = user?.id;
  // The DOM assistant is attached to body, outside the intro's hidden content.
  // Mount only after the video (including autoplay/error recovery) releases the app.
  const enabled = startupReady && !choosingDestination && authReady && isAuthenticated && !!tenantId && !!userId &&
    can('office.access') && !isWebDeviceLoginRoute(pathname) && !/^\/(?:auth|portal)(?:\/|$)/.test(pathname);

  useEffect(() => {
    if (!enabled || !tenantId || !userId || typeof document === 'undefined') return;
    const speech = createNeoSpeech();
    const unmount = mountRobotAssistant({
      robotUrl: robotAssetUrl(),
      canNavigate: (destination) => current.current.can(destination.permission) && current.current.hasModuleGate(destination.route.startsWith('/assist') ? 'assist' : 'office'),
      canSearchClients: () => current.current.can('office.clients.view') && current.current.hasModuleGate('office'),
      navigate: (route) => { current.current.router.push(route as never); },
      back: () => { if (!current.current.router.canGoBack()) return false; current.current.router.back(); return true; },
      canGoBack: () => current.current.router.canGoBack(),
      loadVoice: speech.loadVoice,
      prepareVoice: speech.prepare,
      getProfileName: () => current.current.profileName,
      getWeather: getNeoWeather,
      positionKey: `caresuite.neo.position.v1:${tenantId}:${userId}`,
      searchClients: async (name) => {
        // Search by one name part; the existing service handles role, tenant and RLS.
        // Apply the complete name locally and retain all matches, including duplicates.
        const lastPart = name.trim().split(/\s+/).at(-1)!;
        const variants = [...new Set([lastPart, lastPart.replace(/ae/gi, 'ä').replace(/oe/gi, 'ö').replace(/ue/gi, 'ü')])];
        const results = await Promise.all(variants.map((search) => fetchClientList(tenantId, role, { search, lifecycleFilter: 'all' })));
        const clients = new Map<string, VoiceClient>();
        for (const result of results) {
          if (!result.ok || !result.data || result.data.length >= 1000) throw new Error('client-search-unavailable');
          for (const client of result.data) {
            if (client.tenantId === tenantId) clients.set(client.id, client);
          }
        }
        return matchVoiceClients(name, [...clients.values()]).map(({ id, firstName, lastName, city }) => ({ id, firstName, lastName, city }));
      },
    });
    return () => { unmount(); speech.dispose(); };
  }, [enabled, tenantId, userId, role]);
  return null;
}
