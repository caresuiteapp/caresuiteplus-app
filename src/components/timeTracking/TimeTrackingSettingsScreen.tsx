import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import { AuroraSegmentedControl } from '@/components/aurora';
import {
  ErrorState,
  LoadingState,
  PremiumButton,
  SectionPanel,
  SuccessState,
} from '@/components/ui';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import {
  fetchTimeTrackingCatalogs,
  fetchTimeTrackingSettings,
  updateTimeTrackingSettings,
  upsertActivityType,
  upsertCostCenter,
  upsertWorkOrganization,
} from '@/lib/timeTracking';
import { WfmCheckinQrPanel } from '@/components/wfm/WfmCheckinQrPanel';
import { typography } from '@/theme';

type SettingsTab = 'general' | 'activities' | 'organizations' | 'cost_centers' | 'projects';

const TABS: Array<{ key: SettingsTab; label: string }> = [
  { key: 'general', label: 'Allgemein' },
  { key: 'activities', label: 'Tätigkeiten' },
  { key: 'organizations', label: 'Organisation' },
  { key: 'cost_centers', label: 'Kostenstellen' },
  { key: 'projects', label: 'Projekte' },
];

export function TimeTrackingSettingsScreen() {
  const { profile, user } = useAuth();
  const tenantId = useServiceTenantId();
  const userId = user?.id ?? profile?.id ?? '';
  const roleKey = profile?.roleKey ?? null;
  const { can, check, roleLabel } = usePermissions();
  const text = useAuroraAdaptiveText();
  const [tab, setTab] = useState<SettingsTab>('general');
  const [message, setMessage] = useState<string | null>(null);

  const canManage = can('time.settings.manage');

  const settingsQuery = useAsyncQuery(
    useCallback(async () => {
      if (!tenantId || !canManage) return { ok: false as const, error: 'Keine Berechtigung.' };
      return fetchTimeTrackingSettings(tenantId, roleKey);
    }, [tenantId, roleKey, canManage]),
    [tenantId, roleKey, canManage],
  );

  const catalogQuery = useAsyncQuery<{ organizations: import('@/types/modules/timeTracking').WorkOrganization[]; costCenters: import('@/types/modules/timeTracking').CostCenter[]; projects: import('@/types/modules/timeTracking').WorkProject[]; activityTypes: import('@/types/modules/timeTracking').ActivityType[] } | null>(
    useCallback(async () => {
      if (!tenantId || !canManage) return { ok: true as const, data: null };
      return fetchTimeTrackingCatalogs(tenantId, roleKey);
    }, [tenantId, roleKey, canManage]),
    [tenantId, roleKey, canManage],
  );

  if (!canManage) {
    return (
      <ScreenShell title="Homeoffice & Arbeitszeit" subtitle="Einstellungen → Personal">
        <LockedActionBanner
          message={check('time.settings.manage').reason ?? 'Keine Berechtigung.'}
          roleLabel={roleLabel}
        />
      </ScreenShell>
    );
  }

  if (settingsQuery.loading && !settingsQuery.data) {
    return (
      <ScreenShell title="Homeoffice & Arbeitszeit" subtitle="Wird geladen…">
        <LoadingState message="Einstellungen werden geladen…" />
      </ScreenShell>
    );
  }

  if (settingsQuery.error && !settingsQuery.data) {
    return (
      <ScreenShell title="Homeoffice & Arbeitszeit" subtitle="Fehler">
        <ErrorState message={settingsQuery.error} onRetry={settingsQuery.refresh} />
      </ScreenShell>
    );
  }

  const settings = settingsQuery.data!;
  const catalogs = catalogQuery.data;

  return (
    <ScreenShell title="Homeoffice & Arbeitszeit" subtitle="Einstellungen → Personal" scroll>
      <SectionPanel title="Hinweis">
        <Text style={{ color: text.secondary, ...typography.caption }}>
          Es werden ausschließlich Metadaten-Aktivitätssignale erfasst. Keine Keylogger, Screenshots oder private
          App-Überwachung.
        </Text>
      </SectionPanel>

      <AuroraSegmentedControl options={TABS} value={tab} onChange={(key) => setTab(key as SettingsTab)} />

      {tab === 'general' ? (
        <>
        <SectionPanel title="Allgemein">
          <Text style={{ color: text.primary }}>Modul aktiv: {settings.moduleEnabled ? 'Ja' : 'Nein'}</Text>
          <Text style={{ color: text.primary }}>
            Datenschutz-Einwilligung: {settings.requirePrivacyConsent ? 'Erforderlich' : 'Optional'}
          </Text>
          <Text style={{ color: text.primary }}>
            Inaktivität nach {settings.inactivityTriggerMinutes} min, Antwortfenster {settings.inactivityResponseMinutes}{' '}
            min
          </Text>
          <Text style={{ color: text.primary }}>Hinweis nach {settings.warningThresholdPerDay} Prüfungen/Tag</Text>
          <PremiumButton
            title="Microsoft-Metadaten aktivieren"
            variant="secondary"
            onPress={() => {
              updateTimeTrackingSettings(tenantId!, roleKey, { integrationMicrosoft: true });
              setMessage('Microsoft-Integration (Metadaten) aktiviert.');
              void settingsQuery.refresh();
            }}
          />
        </SectionPanel>
        {tenantId && userId ? (
          <WfmCheckinQrPanel tenantId={tenantId} userId={userId} />
        ) : null}
        </>
      ) : null}

      {tab === 'activities' ? (
        <SectionPanel title="Tätigkeitsarten">
          {(catalogs?.activityTypes ?? []).map((a) => (
            <Text key={a.id} style={{ color: text.primary, marginBottom: careSpacing.xs }}>
              {a.code} — {a.name} ({a.category})
            </Text>
          ))}
          <PremiumButton
            title="Beispiel-Tätigkeit hinzufügen"
            variant="secondary"
            onPress={() => {
              upsertActivityType(tenantId!, roleKey, {
                code: `TA${Date.now() % 1000}`,
                name: 'Neue Tätigkeit',
                category: 'office',
              });
              void catalogQuery.refresh();
            }}
          />
        </SectionPanel>
      ) : null}

      {tab === 'organizations' ? (
        <SectionPanel title="Organisationseinheiten">
          {(catalogs?.organizations ?? []).map((o) => (
            <Text key={o.id} style={{ color: text.primary, marginBottom: careSpacing.xs }}>
              {o.code} — {o.name}
            </Text>
          ))}
          <PremiumButton
            title="Organisation hinzufügen"
            variant="secondary"
            onPress={() => {
              upsertWorkOrganization(tenantId!, roleKey, {
                code: `ORG${Date.now() % 100}`,
                name: 'Neue Organisation',
              });
              void catalogQuery.refresh();
            }}
          />
        </SectionPanel>
      ) : null}

      {tab === 'cost_centers' ? (
        <SectionPanel title="Kostenstellen">
          {(catalogs?.costCenters ?? []).map((c) => (
            <Text key={c.id} style={{ color: text.primary, marginBottom: careSpacing.xs }}>
              {c.code} — {c.name}
            </Text>
          ))}
          <PremiumButton
            title="Kostenstelle hinzufügen"
            variant="secondary"
            onPress={() => {
              upsertCostCenter(tenantId!, roleKey, {
                code: `KS${Date.now() % 100}`,
                name: 'Neue Kostenstelle',
              });
              void catalogQuery.refresh();
            }}
          />
        </SectionPanel>
      ) : null}

      {tab === 'projects' ? (
        <SectionPanel title="Projekte">
          {(catalogs?.projects ?? []).map((p) => (
            <Text key={p.id} style={{ color: text.primary, marginBottom: careSpacing.xs }}>
              {p.code} — {p.name}
            </Text>
          ))}
        </SectionPanel>
      ) : null}

      {message ? <SuccessState title="Gespeichert" message={message} /> : null}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({});
