import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { PreparedTemplateBanner } from '@/components/templates';
import { CareLightPageShell } from '@/components/layout';
import { ErrorState, LoadingState, PremiumButton } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { getTenantTemplateSettings, updateTenantTemplateSettings } from '@/lib/templates';
import { colors, spacing, typography } from '@/theme';

export function TemplateSettingsScreen() {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { roleLabel, can } = usePermissions();
  const [saving, setSaving] = useState(false);

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return getTenantTemplateSettings(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  if (query.loading && !query.data) {
    return (
      <CareLightPageShell title="Vorlagen-Einstellungen" subtitle="Wird geladen…">
        <LoadingState message="Einstellungen werden geladen…" />
      </CareLightPageShell>
    );
  }

  if (query.error && !query.data) {
    return (
      <CareLightPageShell title="Vorlagen-Einstellungen" subtitle="Fehler">
        <ErrorState message={query.error} onRetry={query.refresh} />
      </CareLightPageShell>
    );
  }

  const settings = query.data!;

  const toggle = async (key: 'allowTenantOverrides' | 'showSystemTemplates', value: boolean) => {
    if (!tenantId || !can('office.catalogs.edit')) return;
    setSaving(true);
    await updateTenantTemplateSettings(tenantId, { [key]: value }, profile?.roleKey);
    await query.refresh();
    setSaving(false);
  };

  return (
    <CareLightPageShell title="Vorlagen-Einstellungen" subtitle={`Template Center · ${roleLabel ?? 'Demo'}`}>
      <PreparedTemplateBanner />
      <View style={styles.list}>
        <View style={styles.row}>
          <Text style={styles.label}>Mandanten-Anpassungen erlauben</Text>
          <Switch
            value={settings.allowTenantOverrides}
            onValueChange={(v) => toggle('allowTenantOverrides', v)}
            disabled={saving || !can('office.catalogs.edit')}
          />
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Systemvorlagen anzeigen</Text>
          <Switch
            value={settings.showSystemTemplates}
            onValueChange={(v) => toggle('showSystemTemplates', v)}
            disabled={saving || !can('office.catalogs.edit')}
          />
        </View>
        <Text style={styles.meta}>Sprache: {settings.defaultLocale}</Text>
        <PremiumButton title="Aktualisieren" variant="secondary" onPress={query.refresh} />
      </View>
    </CareLightPageShell>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  label: { ...typography.body, flex: 1, paddingRight: spacing.md },
  meta: { ...typography.caption, color: colors.textMuted },
});
