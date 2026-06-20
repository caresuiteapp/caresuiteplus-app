import { isAssistTripsLiveReady } from '@/lib/assist/assistModuleConfig';
import { isGpsTrackingLiveReady } from '@/lib/assist/gpsTrackingConfig';
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

/** Non-intrusive setup hints — schema gaps and missing prod config. No DB writes. */
export function buildAssistSetupHints(): AssistSetupHint[] {
  const hints: AssistSetupHint[] = [];

  if (getServiceMode() === 'supabase' && !isSupabaseConfigured()) {
    hints.push({
      id: 'supabase-config',
      title: 'Supabase nicht konfiguriert',
      message:
        'Assist speichert Einsätze erst nach Supabase-Anbindung persistent. Demo-Modus aktiv.',
      severity: 'warning',
    });
  }

  if (getServiceMode() === 'supabase') {
    hints.push({
      id: 'signature-storage',
      title: 'Signatur-Speicher (0156)',
      message:
        'Unterschriften werden in assist_visit_signatures + Storage persistiert, sobald ein assist_visits-Datensatz existiert.',
      severity: 'info',
      route: '/assist/signaturen',
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

  if (!isAssistTripsLiveReady()) {
    hints.push({
      id: 'trips-storage',
      title: 'Fahrtenbuch',
      message:
        'Live-Fahrtenbuch (Migration 0114) erfordert Supabase ohne Demo-Modus. Aktuell Demo- oder leerer Zustand.',
      severity: 'info',
      route: '/assist/fahrten',
    });
  }

  if (!isGpsTrackingLiveReady()) {
    hints.push({
      id: 'live-tracking',
      title: 'Live-Tracking Backend',
      message:
        '0156-Tabellen aktiv — Tracking startet im Mitarbeiterportal. Assist Live-Status liest persistierte Sessions/Events (read-only).',
      severity: 'info',
      route: '/assist/live-status',
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
    message: 'assist_routes / assist_route_items fehlen — Touren-UI ohne Persistenz.',
    severity: 'info',
    route: '/assist/touren',
  });

  return hints;
}
