import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { isDataSubjectRequestBackendReady } from '@/lib/privacy/dataRequestConfig';
import { isGpsTrackingLiveReady } from '@/lib/assist/gpsTrackingConfig';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('DSGVO data-subject screens (Sprint 47)', () => {
  it('DataRequestScreen und AccountDeletionRequestScreen existieren', () => {
    expect(existsSync(path.join(root, 'src/screens/settings/DataRequestScreen.tsx'))).toBe(true);
    expect(existsSync(path.join(root, 'src/screens/settings/AccountDeletionRequestScreen.tsx'))).toBe(
      true,
    );
  });

  it('App-Routen verbinden DSGVO-Screens', () => {
    expect(readSrc('app/settings/data-request.tsx')).toContain('DataRequestScreen');
    expect(readSrc('app/settings/account-deletion.tsx')).toContain('AccountDeletionRequestScreen');
  });

  it('preparedOnly im Demo-Modus: Submit deaktiviert', () => {
    const panel = readSrc('src/components/privacy/DataSubjectRequestPanel.tsx');
    const config = readSrc('src/lib/privacy/dataRequestConfig.ts');
    expect(config).toContain('isDataSubjectRequestBackendReady');
    expect(config).toContain('isSupabaseConfigured');
    expect(config).toContain('isDemoMode');
    expect(panel).toContain('isDataSubjectRequestBackendReady');
    expect(panel).toContain('disabled={preparedOnly');
    expect(isDataSubjectRequestBackendReady()).toBe(false);
  });

  it('Live-Submit nur mit backendReady-Guard und echtem Service', () => {
    const panel = readSrc('src/components/privacy/DataSubjectRequestPanel.tsx');
    const service = readSrc('src/lib/privacy/dataSubjectRequestService.ts');
    const repo = readSrc('src/lib/privacy/dataSubjectRequests.supabase.ts');
    expect(panel).toContain('submitDataSubjectRequest');
    expect(panel).toContain('backendReady && submitted');
    expect(service).toContain('dataSubjectRequestsSupabaseRepository');
    expect(service).not.toContain('service_role');
    expect(repo).not.toContain('service_role');
  });

  it('nutzt supportLinks für Datenschutz, Hilfe und Support-E-Mail', () => {
    const panel = readSrc('src/components/privacy/DataSubjectRequestPanel.tsx');
    expect(panel).toContain('SUPPORT_LINKS');
    expect(panel).toContain('SUPPORT_LINKS.privacy');
    expect(panel).toContain('SUPPORT_LINKS.help');
    expect(panel).toContain('SUPPORT_LINKS.supportEmail');
  });

  it('Shell-Footer verlinken Betroffenenrechte', () => {
    expect(readSrc('src/components/layout/DesktopShell.tsx')).toContain('/settings/data-request');
    expect(readSrc('src/components/layout/TabletShell.tsx')).toContain('/settings/data-request');
    expect(readSrc('src/components/layout/AppStartFooter.tsx')).toContain('/settings/data-request');
  });

  it('AccountDeletionScreen warnt vor unwiderruflicher Löschung', () => {
    const screen = readSrc('src/screens/settings/AccountDeletionRequestScreen.tsx');
    expect(screen).toContain('showDeletionWarning');
    expect(screen).toContain('Art. 17 DSGVO');
    expect(screen).toContain('requestType="deletion"');
  });
});

describe('DSGVO data_subject_requests repository (Sprint 49)', () => {
  it('Migration 0031 ist safe CREATE TABLE IF NOT EXISTS mit RLS', () => {
    const migration = readSrc('supabase/migrations/0031_data_subject_requests.sql');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.data_subject_requests');
    expect(migration).toContain('ENABLE ROW LEVEL SECURITY');
    expect(migration).toContain('data_subject_requests_tenant_isolation');
    expect(migration).not.toMatch(/\b(DROP\s+(TABLE|INDEX)|TRUNCATE\s+TABLE|DELETE\s+FROM)\b/i);
  });

  it('Screens setzen requestType für Live-Insert', () => {
    expect(readSrc('src/screens/settings/DataRequestScreen.tsx')).toContain('requestType="access"');
    expect(readSrc('src/screens/settings/AccountDeletionRequestScreen.tsx')).toContain(
      'requestType="deletion"',
    );
  });
});

describe('EAS readiness sync (Sprint 48)', () => {
  it('app.config.ts spiegelt supportLinks vollständig', () => {
    const appConfig = readSrc('app.config.ts');
    const supportLinks = readSrc('src/lib/platform/supportLinks.ts');
    expect(appConfig).toContain("import { SUPPORT_LINKS } from './src/lib/platform/supportLinks'");
    expect(appConfig).toContain('supportLinks: { ...SUPPORT_LINKS }');
    for (const key of ['help', 'privacy', 'imprint', 'terms', 'supportEmail']) {
      expect(supportLinks).toContain(`${key}:`);
    }
  });

  it('store-readiness-check prüft DSGVO preparedOnly und app.config', () => {
    const script = readSrc('scripts/store-readiness-check.mjs');
    expect(script).toContain('isDataSubjectRequestBackendReady');
    expect(script).toContain('SUPPORT_LINKS');
  });
});

describe('Assist GPS preparedOnly polish (Sprint 50)', () => {
  it('gpsTrackingConfig bleibt ehrlich preparedOnly', () => {
    const config = readSrc('src/lib/assist/gpsTrackingConfig.ts');
    expect(config).toContain('isGpsTrackingLiveReady');
    expect(isGpsTrackingLiveReady()).toBe(false);
  });

  it('TrackingListView zeigt GPS-Vorbereitung-Banner', () => {
    const view = readSrc('src/components/assist/TrackingListView.tsx');
    expect(view).toContain('isGpsTrackingLiveReady');
    expect(view).toContain('GPS_TRACKING_PREPARED_MESSAGE');
    expect(view).toContain('InfoBanner');
  });

  it('TrackingListHero zeigt GPS-Badge statt irreführendem Demo-Label', () => {
    const hero = readSrc('src/components/assist/TrackingListHero.tsx');
    expect(hero).toContain('GPS extern');
    expect(hero).toContain('Geofence-Snapshot');
    expect(hero).not.toContain('Geofence-Demo');
  });
});

describe('DSGVO Admin-Listenansicht (Sprint 51)', () => {
  it('Admin-Route und Screen existieren', () => {
    expect(existsSync(path.join(root, 'app/business/security/data-requests.tsx'))).toBe(true);
    expect(existsSync(path.join(root, 'src/screens/security/DataSubjectRequestsAdminScreen.tsx'))).toBe(
      true,
    );
    expect(readSrc('app/business/security/data-requests.tsx')).toContain(
      'DataSubjectRequestsAdminScreen',
    );
  });

  it('Admin-Service nutzt guardServiceTenant und Live-Repo listForTenant', () => {
    const service = readSrc('src/lib/privacy/dataSubjectRequestAdminService.ts');
    const repo = readSrc('src/lib/privacy/dataSubjectRequests.supabase.ts');
    expect(service).toContain('guardServiceTenant');
    expect(service).toContain('enforcePermission');
    expect(service).toContain('security.view');
    expect(service).toContain('listForTenant');
    expect(service).not.toContain('service_role');
    expect(repo).toContain('listForTenant');
    expect(repo).not.toContain('service_role');
  });

  it('Admin-UI ist read-only mit business_admin KPI-Hero', () => {
    const listView = readSrc('src/components/privacy/DataSubjectRequestsAdminListView.tsx');
    const hero = readSrc('src/components/privacy/DataSubjectRequestsAdminHero.tsx');
    expect(listView).toContain('security.view');
    expect(listView).toContain('security.manage');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('canManage');
  });

  it('SecurityHub verlinkt DSGVO-Anfragen', () => {
    expect(readSrc('src/screens/security/SecurityHubScreen.tsx')).toContain(
      '/business/security/data-requests',
    );
  });
});

describe('DSGVO Admin Status-Update (Sprint 58)', () => {
  it('Migration 0032 fügt Admin-UPDATE RLS hinzu (safe ADD, kein DROP)', () => {
    const migration = readSrc(
      'supabase/migrations/0032_data_subject_requests_admin_status_update.sql',
    );
    expect(migration).toContain('CREATE POLICY data_subject_requests_admin_status_update');
    expect(migration).toContain("has_permission('security.manage')");
    expect(migration).not.toContain('DROP POLICY');
  });

  it('Admin-Service und Repo unterstützen updateStatus ohne service_role', () => {
    const service = readSrc('src/lib/privacy/dataSubjectRequestAdminService.ts');
    const repo = readSrc('src/lib/privacy/dataSubjectRequests.supabase.ts');
    expect(service).toContain('updateDataSubjectRequestStatusForAdmin');
    expect(service).toContain('security.manage');
    expect(repo).toContain('updateStatus');
    expect(service).not.toContain('service_role');
    expect(repo).not.toContain('service_role');
  });

  it('Admin-ListView bietet Status-FilterChips bei security.manage', () => {
    const listView = readSrc('src/components/privacy/DataSubjectRequestsAdminListView.tsx');
    expect(listView).toContain('FilterChipGroup');
    expect(listView).toContain('Status ändern');
    expect(listView).toContain('updateStatus');
  });
});

describe('DSGVO Admin Fristen + Export (Sprint 59)', () => {
  it('SLA-Konstanten und Frist-Berechnung aus created_at/received_at', () => {
    const sla = readSrc('src/lib/privacy/dataSubjectRequestSla.ts');
    expect(sla).toContain('DSGVO_ART12_RESPONSE_DAYS');
    expect(sla).toContain('getDataSubjectRequestDeadlineInfo');
    expect(sla).toContain('buildDataSubjectRequestsAdminCsv');
  });

  it('Admin-Service exportiert CSV nur Live (preparedOnly)', () => {
    const service = readSrc('src/lib/privacy/dataSubjectRequestAdminService.ts');
    expect(service).toContain('exportDataSubjectRequestsForAdmin');
    expect(service).toContain('isDataSubjectRequestBackendReady');
    expect(service).toContain('buildDataSubjectRequestsAdminCsv');
    expect(service).not.toContain('sendMail');
    expect(service).not.toContain('service_role');
  });

  it('Admin-ListView zeigt Frist-Badges und Export preparedOnly', () => {
    const listView = readSrc('src/components/privacy/DataSubjectRequestsAdminListView.tsx');
    const hero = readSrc('src/components/privacy/DataSubjectRequestsAdminHero.tsx');
    expect(listView).toContain('getDataSubjectRequestDeadlineInfo');
    expect(listView).toContain('deadlineBadgeVariant');
    expect(listView).toContain('CSV-Export in Vorbereitung');
    expect(listView).toContain('exportLiveReady');
    expect(hero).toContain('CSV-Export Live');
    expect(hero).toContain('Export in Vorbereitung');
    expect(hero).toContain('DSGVO_ART12_RESPONSE_DAYS');
  });
});

describe('DSGVO Admin E-Mail notify (Sprint 71)', () => {
  it('Edge Function notify-data-subject-request-admin existiert mit Resend prepared_only', () => {
    const edge = readSrc('supabase/functions/notify-data-subject-request-admin/index.ts');
    const shared = readSrc('supabase/functions/_shared/dsgvoAdminNotify.ts');
    expect(edge).toContain('dsgvoAdminNotify');
    expect(shared).toContain('prepared_only');
    expect(edge).toContain('RESEND_API_KEY');
    expect(edge).toContain('DSGVO_NOTIFY_FROM_EMAIL');
    expect(edge).not.toContain('ok: true, sent: true');
  });

  it('submitDataSubjectRequest ruft Admin-Notify nach erfolgreichem Insert auf', () => {
    const service = readSrc('src/lib/privacy/dataSubjectRequestService.ts');
    expect(service).toContain('notifyAdminsOfNewDataSubjectRequest');
    expect(service).not.toContain('service_role');
  });

  it('Admin-UI zeigt ehrliche Admin-Mail-Badges und Banner', () => {
    const hero = readSrc('src/components/privacy/DataSubjectRequestsAdminHero.tsx');
    const listView = readSrc('src/components/privacy/DataSubjectRequestsAdminListView.tsx');
    expect(hero).toContain('Admin-Mail Edge');
    expect(hero).toContain('Admin-Mail in Vorbereitung');
    expect(listView).toContain('DSGVO_ADMIN_NOTIFY_PREPARED_MESSAGE');
    expect(listView).toContain('Admin-E-Mail-Benachrichtigung');
  });
});

describe('Portal Dashboard Hero polish (Sprint 52)', () => {
  it('PortalDashboardHero nutzt PremiumListHeroFrame für beide Portale', () => {
    const hero = readSrc('src/components/portal/PortalDashboardHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('portal_employee');
    expect(hero).toContain('portal_client');
    expect(hero).toContain('MITARBEITERPORTAL');
    expect(hero).toContain('KLIENT:INNENPORTAL');
  });

  it('PortalOverviewTab ersetzt DashboardHero durch PortalDashboardHero', () => {
    const tab = readSrc('src/components/portal/PortalOverviewTab.tsx');
    expect(tab).toContain('HeroComponent={PortalDashboardHero}');
  });

  it('Portal-Schnellaktionen haben echte Tab-Routen', () => {
    const dashboard = readSrc('src/data/demo/dashboard.ts');
    expect(dashboard).toContain('/portal/employee/assignments');
    expect(dashboard).toContain('/portal/client/appointments');
    expect(dashboard).toContain('/portal/client/messages');
  });
});
