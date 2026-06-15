import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { PreparedModeBanner } from '@/components/modules/PreparedModeBanner';
import { PflegeSettingsHero, PFLEGE_SETTINGS_PREPARED_MESSAGE } from '@/components/pflege/PflegeSettingsHero';
import { ScreenShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState, PremiumButton, PremiumInput } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import {
  fetchPflegeModuleSettings,
  updatePflegeModuleSettings,
} from '@/lib/pflege/moduleExtensionService';
import type { PflegeModuleSettings } from '@/types/modules/pflege';
import { colors, spacing, typography } from '@/theme';

const ROWS: { key: keyof PflegeModuleSettings; label: string }[] = [
  { key: 'sisEnabled', label: 'SIS-Assessments aktiv' },
  { key: 'vitalAlertsEnabled', label: 'Vitalwert-Warnungen' },
  { key: 'woundDocumentationEnabled', label: 'Wunddokumentation' },
  { key: 'bodyMapEnabled', label: 'BodyMap (vorbereitet)' },
  { key: 'mdkExportPrepared', label: 'MDK-Export vorbereitet' },
  { key: 'autoHandoverHints', label: 'Übergabe-Hinweise' },
];

export function PflegeSettingsScreen() {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { roleLabel } = usePermissions();
  const roleKey = profile?.roleKey ?? 'nurse';
  const [saving, setSaving] = useState(false);

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchPflegeModuleSettings(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  if (query.loading && !query.data) {
    return (
      <ScreenShell title="Pflege-Einstellungen" subtitle="Wird geladen…">
        <LoadingState message="Einstellungen werden geladen…" />
      </ScreenShell>
    );
  }

  if (query.error && !query.data) {
    return (
      <ScreenShell title="Pflege-Einstellungen" subtitle="Fehler">
        <ErrorState message={query.error} onRetry={query.refresh} />
      </ScreenShell>
    );
  }

  const settings = query.data!;

  const toggle = async (key: keyof PflegeModuleSettings, value: boolean) => {
    if (!tenantId) return;
    setSaving(true);
    await updatePflegeModuleSettings(tenantId, { [key]: value }, profile?.roleKey);
    await query.refresh();
    setSaving(false);
  };

  return (
    <ScreenShell title="Pflege-Einstellungen" subtitle={`Modul · ${roleLabel ?? 'Demo'}`}>
      <PflegeSettingsHero settings={settings} roleKey={roleKey} />
      <PreparedModeBanner hint={PFLEGE_SETTINGS_PREPARED_MESSAGE} />
      <View style={styles.list}>
        {ROWS.map((row) => (
          <View key={row.key} style={styles.row}>
            <Text style={styles.label}>{row.label}</Text>
            <Switch
              value={!!settings[row.key]}
              onValueChange={(v) => toggle(row.key, v)}
              disabled={saving}
              trackColor={{ true: colors.success, false: colors.bgPanel }}
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
