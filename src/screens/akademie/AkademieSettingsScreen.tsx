import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { AkademieSettingsHero } from '@/components/akademie';
import { ScreenShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState, PremiumButton, PremiumInput } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import {
  fetchAkademieModuleSettings,
  updateAkademieModuleSettings,
} from '@/lib/akademie/moduleExtensionService';
import type { AkademieModuleSettings } from '@/types/modules/akademie';
import { colors, spacing, typography } from '@/theme';

const ROWS: { key: keyof AkademieModuleSettings; label: string }[] = [
  { key: 'mandatoryReminders', label: 'Pflichtschulungs-Erinnerung' },
  { key: 'certificateAutoIssue', label: 'Zertifikat automatisch ausstellen' },
  { key: 'examRequired', label: 'Prüfung erforderlich' },
  { key: 'externalInstructors', label: 'Externe Dozent:innen' },
  { key: 'progressTracking', label: 'Lernfortschritt tracken' },
];

export function AkademieSettingsScreen() {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { roleLabel } = usePermissions();
  const roleKey = profile?.roleKey ?? 'akademie_admin';
  const [saving, setSaving] = useState(false);

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchAkademieModuleSettings(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  if (query.loading && !query.data) {
    return (
      <ScreenShell title="Akademie-Einstellungen" subtitle="Wird geladen…">
        <LoadingState message="Einstellungen werden geladen…" />
      </ScreenShell>
    );
  }

  if (query.error && !query.data) {
    return (
      <ScreenShell title="Akademie-Einstellungen" subtitle="Fehler">
        <ErrorState message={query.error} onRetry={query.refresh} />
      </ScreenShell>
    );
  }

  const settings = query.data!;

  const toggle = async (key: keyof AkademieModuleSettings, value: boolean) => {
    if (!tenantId) return;
    setSaving(true);
    await updateAkademieModuleSettings(tenantId, { [key]: value }, profile?.roleKey);
    await query.refresh();
    setSaving(false);
  };

  return (
    <ScreenShell title="Akademie-Einstellungen" subtitle={`Modul · ${roleLabel ?? 'Demo'}`}>
      <AkademieSettingsHero settings={settings} roleKey={roleKey} />
      <View style={styles.list}>
        {ROWS.map((row) => (
          <View key={row.key} style={styles.row}>
            <Text style={styles.label}>{row.label}</Text>
            <Switch
              value={!!settings[row.key]}
              onValueChange={(v) => toggle(row.key, v)}
              disabled={saving}
              trackColor={{ true: '#FFD166', false: colors.bgPanel }}
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
