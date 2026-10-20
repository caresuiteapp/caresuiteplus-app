import { Platform } from 'react-native';
import { getSupabaseClient } from '@/lib/supabase/client';

export type DocumentationAiAvailability = {
  available: boolean;
  reason: string | null;
  canUseLocalFallback: boolean;
};

export function resolveDocumentationAiAvailability(tenantId: string | null): DocumentationAiAvailability {
  if (!tenantId) {
    return {
      available: false,
      reason: 'KI-Hilfe erfordert eine aktive Mandantenverbindung.',
      canUseLocalFallback: true,
    };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return {
      available: false,
      reason: 'KI-Hilfe ist offline nicht verfügbar. Lokale Textvorlagen stehen bereit.',
      canUseLocalFallback: true,
    };
  }

  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.onLine === false) {
    return {
      available: false,
      reason: 'Keine Internetverbindung. Nutzen Sie lokale Textvorlagen.',
      canUseLocalFallback: true,
    };
  }

  return {
    available: true,
    reason: null,
    canUseLocalFallback: true,
  };
}
