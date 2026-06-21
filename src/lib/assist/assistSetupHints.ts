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

/** Non-intrusive setup hints — accurate persistence status, user-facing German only. */
export function buildAssistSetupHints(): AssistSetupHint[] {
  const hints: AssistSetupHint[] = [];
  const persistenceActive = isAssistTrackingPersistenceActive();

  if (getServiceMode() === 'supabase' && !isSupabaseConfigured()) {
    hints.push({
      id: 'cloud-config',
      title: 'Cloud-Anbindung ausstehend',
      message:
        'Assist speichert Einsätze erst nach Cloud-Anbindung dauerhaft. Demo-Modus ist aktiv.',
      severity: 'warning',
    });
  }

  if (persistenceActive) {
    hints.push({
      id: 'persistence-active',
      title: 'Datenspeicherung aktiv',
      message:
        'Einsätze, Nachweise, Signaturen und Tracking werden dauerhaft gespeichert.',
      severity: 'info',
      route: '/assist/nachweise',
    });
  } else if (getServiceMode() === 'supabase') {
    hints.push({
      id: 'persistence-demo',
      title: 'Demo-Modus',
      message: 'Cloud ist verbunden, Demo-Modus aktiv — Persistenz für Live-Mandanten ohne Demo-Flag.',
      severity: 'warning',
    });
  } else {
    hints.push({
      id: 'signature-storage',
      title: 'Signatur-Speicher (Demo)',
      message: 'Demo-Modus: Unterschriften nur für die aktuelle Sitzung gespeichert.',
      severity: 'warning',
      route: '/assist/signaturen',
    });
  }

  if (!isAssistMapProviderConfigured() && persistenceActive) {
    hints.push({
      id: 'map-provider-optional',
      title: 'Kartenansicht optional',
      message:
        'Live-Karten erfordern einen externen Kartenanbieter. Standortdaten werden als Textliste angezeigt.',
      severity: 'info',
      route: '/assist/live-status',
    });
  }

  if (!isAssistTripsLiveReady()) {
    hints.push({
      id: 'trips-storage',
      title: 'Fahrtenbuch',
      message:
        'Live-Fahrtenbuch erfordert Cloud ohne Demo-Modus. Aktuell Demo- oder leerer Zustand.',
      severity: 'info',
      route: '/assist/fahrten',
    });
  }

  hints.push({
    id: 'employee-portal-gps-consent',
    title: 'Standort nur im Mitarbeiterportal',
    message:
      'Anfahrt, GPS und Live-Timer starten ausschließlich im Mitarbeiterportal. Assist/Office: Nur Anzeige.',
    severity: 'info',
    route: '/portal/employee/assignments',
  });

  hints.push({
    id: 'geofence-geocoding',
    title: 'Geofence Zielkoordinaten',
    message:
      'Weicher Geofence-Check (50–250 m) benötigt Zielkoordinaten — Adress-Geocoding folgt; Override-Begründung möglich.',
    severity: 'info',
  });

  hints.push({
    id: 'client-portal-tracking-view',
    title: 'Klientenportal Live-Ansicht',
    message:
      'Eingeschränkter Einsatzstatus (ohne GPS-Punkte) — vollständiges Freigabefenster folgt separat.',
    severity: 'info',
  });

  hints.push({
    id: 'routes-planning',
    title: 'Tourenplanung',
    message: 'Touren werden derzeit ohne dauerhafte Speicherung geplant — eigene Route unter Touren.',
    severity: 'info',
    route: '/assist/touren',
  });

  return hints;
}
