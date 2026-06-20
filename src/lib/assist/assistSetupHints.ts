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

  hints.push({
    id: 'signature-storage',
    title: 'Signatur-Speicher (Schema-Gap P0)',
    message:
      'Tabelle assist_visit_signatures fehlt — Unterschriften werden nur sessionbasiert erfasst, nicht auditierbar gespeichert.',
    severity: 'warning',
    route: '/assist/signaturen',
  });

  hints.push({
    id: 'proof-export',
    title: 'Leistungsnachweis-Persistenz (Schema-Gap P0)',
    message:
      'Tabelle assist_visit_proofs fehlt — PDF-Export ist Vorschau; dauerhafte Nachweis-Ablage folgt mit Migration.',
    severity: 'warning',
    route: '/assist/nachweise',
  });

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
        'GPS-Echtzeit-Streaming erfordert externe Freigabe. assist_live_status / assist_tracking_points fehlen — Mitarbeiterportal erfasst Foreground-GPS sessionbasiert.',
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
      'Eingeschränkte Tracking-Sicht im Klientenportal ist vorbereitet (Freigabefenster) — dedizierte UI/assist_portal_events fehlen.',
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
