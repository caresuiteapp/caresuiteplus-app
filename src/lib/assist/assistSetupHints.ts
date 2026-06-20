import { isAssistTripsLiveReady } from '@/lib/assist/assistModuleConfig';
import {
  isAssistMapProviderConfigured,
  isAssistTrackingPersistenceActive,
} from '@/lib/assist/gpsTrackingConfig';
import { getServiceMode } from '@/lib/services/mode';
import { isSupabaseConfigured } from '@/lib/supabase/config';

export type AssistSetupHint = {
  id: string;
  title: string;
  message: string;
  severity: 'info' | 'warning';
  /** Optional route for drill-down. */
  route?: string;
};

/** Non-intrusive setup hints — accurate persistence status, no stale migration banners. */
export function buildAssistSetupHints(): AssistSetupHint[] {
  const hints: AssistSetupHint[] = [];
  const persistenceActive = isAssistTrackingPersistenceActive();

  if (getServiceMode() === 'supabase' && !isSupabaseConfigured()) {
    hints.push({
      id: 'supabase-config',
      title: 'Supabase nicht konfiguriert',
      message:
        'Assist speichert Einsätze erst nach Supabase-Anbindung persistent. Demo-Modus aktiv.',
      severity: 'warning',
    });
  }

  if (persistenceActive) {
    hints.push({
      id: 'persistence-active',
      title: 'Persistenz aktiv',
      message:
        'Einsätze, Nachweise, Signaturen und Tracking werden persistent in Supabase gespeichert (0156 angewendet).',
      severity: 'info',
      route: '/assist/nachweise',
    });
  } else if (getServiceMode() === 'supabase') {
    hints.push({
      id: 'persistence-demo',
      title: 'Demo-Modus',
      message: 'Supabase ist verbunden, Demo-Modus aktiv — Persistenz für Live-Mandanten ohne Demo-Flag.',
      severity: 'warning',
    });
  } else {
    hints.push({
      id: 'signature-storage',
      title: 'Signatur-Speicher (Demo)',
      message: 'Demo-Modus: Unterschriften nur sessionbasiert bis Supabase-Live.',
      severity: 'warning',
      route: '/assist/signaturen',
    });
  }

  if (!isAssistMapProviderConfigured() && persistenceActive) {
    hints.push({
      id: 'map-provider-optional',
      title: 'Kartenansicht optional',
      message:
        'Live-Karten erfordern einen externen Map-Provider. Standortdaten werden aus assist_location_points gelesen.',
      severity: 'info',
      route: '/assist/live-status',
    });
  }

  if (!isAssistTripsLiveReady()) {
    hints.push({
      id: 'trips-storage',
      title: 'Fahrtenbuch',
      message:
        'Live-Fahrtenbuch erfordert Supabase ohne Demo-Modus. Aktuell Demo- oder leerer Zustand.',
      severity: 'info',
      route: '/assist/fahrten',
    });
  }

  hints.push({
    id: 'employee-portal-gps-consent',
    title: 'Standort nur im Mitarbeiterportal',
    message:
      'Anfahrt, GPS und Live-Timer starten ausschließlich im Mitarbeiterportal. Assist/Office: Nur Anzeige. Native Background-Tracking: nicht implementiert (Web/PWA Foreground OK).',
    severity: 'info',
    route: '/portal/employee/assignments',
  });

  hints.push({
    id: 'geofence-geocoding',
    title: 'Geofence Zielkoordinaten',
    message:
      'Weicher Geofence-Check (50–250 m) benötigt Ziel-Lat/Lng — Adress-Geocoding/Backend fehlt; Override-Begründung möglich.',
    severity: 'info',
  });

  hints.push({
    id: 'client-portal-tracking-view',
    title: 'Klientenportal Live-Ansicht',
    message:
      'Eingeschränkter Status (ohne GPS-Punkte) aus assist_time_events — vollständiges Freigabefenster folgt separat.',
    severity: 'info',
  });

  hints.push({
    id: 'routes-schema',
    title: 'Tourenplanung',
    message: 'assist_routes / assist_route_items fehlen — Touren-UI ohne Persistenz (eigene Route unter Touren).',
    severity: 'info',
    route: '/assist/touren',
  });

  return hints;
}
