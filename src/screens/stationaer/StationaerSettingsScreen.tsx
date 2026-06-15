import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { StationaerSettingsHero } from '@/components/stationaer';
import { ScreenShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState, PremiumButton, PremiumInput } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import {
  fetchStationaerModuleSettings,
  updateStationaerModuleSettings,
} from '@/lib/stationaer/moduleExtensionService';
import type { StationaerModuleSettings } from '@/types/modules/stationaer';
import { colors, spacing, typography } from '@/theme';

const ROWS: { key: keyof StationaerModuleSettings; label: string }[] = [
  { key: 'occupancyAlerts', label: 'Belegungswarnungen' },
  { key: 'mealPlanningEnabled', label: 'Mahlzeitenplanung' },
  { key: 'activityPlanningEnabled', label: 'Aktivitätenplanung' },
  { key: 'relativeCommunication', label: 'Angehörigenkommunikation' },
  { key: 'handoverRequired', label: 'Übergabe Pflicht' },
  { key: 'riskDocumentation', label: 'Risikodokumentation' },
];

export function StationaerSettingsScreen() {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { roleLabel } = usePermissions();
  const roleKey = profile?.roleKey ?? 'nurse';
  const [saving, setSaving] = useState(false);

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchStationaerModuleSettings(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  if (query.loading && !query.data) {
    return (
      <ScreenShell title="Stationär-Einstellungen" subtitle="Wird geladen…">
        <LoadingState message="Einstellungen werden geladen…" />
      </ScreenShell>
    );
  }

  if (query.error && !query.data) {
    return (
      <ScreenShell title="Stationär-Einstellungen" subtitle="Fehler">
        <ErrorState message={query.error} onRetry={query.refresh} />
      </ScreenShell>
    );
  }

  const settings = query.data!;

  const toggle = async (key: keyof StationaerModuleSettings, value: boolean) => {
    if (!tenantId) return;
    setSaving(true);
    await updateStationaerModuleSettings(tenantId, { [key]: value }, profile?.roleKey);
    await query.refresh();
    setSaving(false);
  };

  return (
    <ScreenShell title="Stationär-Einstellungen" subtitle={`Modul · ${roleLabel ?? 'Demo'}`}>
      <StationaerSettingsHero settings={settings} roleKey={roleKey} />
      <View style={styles.list}>
        {ROWS.map((row) => (
          <View key={row.key} style={styles.row}>
            <Text style={styles.label}>{row.label}</Text>
            <Switch
              value={!!settings[row.key]}
              onValueChange={(v) => toggle(row.key, v)}
              disabled={saving}
              trackColor={{ true: colors.violet, false: colors.bgPanel }}
            />
          </View>
        ))}
        <PremiumButton title="Aktualisieren" variant="secondary" onPress={query.refresh} />
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md, marginTop: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  label: { ...typography.body, color: colors.textPrimary, flex: 1, paddingRight: spacing.md },
});
