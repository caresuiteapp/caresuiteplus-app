import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { LockedActionBanner } from '@/components/permissions';
import { SettingsScreenFrame } from '@/components/settings/settingsscreenframe';
import { ErrorState, LoadingState, PremiumButton, SectionPanel, SuccessState } from '@/components/ui';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import {
  fetchTenantNotificationSettings, saveTenantNotificationSettings, TENANT_PUSH_SETTING_KEYS,
  type TenantNotificationSettings, type TenantPushPreferences, type TenantPushSettingKey,
} from '@/lib/tenant/tenantNotificationSettingsService';
import { TENANT_SETTINGS_PERMISSION } from '@/lib/tenant/tenantSettingsRoute';
import type { RoleKey } from '@/types';

const eventOptions: { key: TenantPushSettingKey; label: string; description: string }[] = [
  { key: 'notify_assignment_changes', label: 'Einsätze und Erinnerungen', description: 'Neue oder geänderte Einsätze sowie freigegebene Erinnerungen an bevorstehende und überfällige Einsätze.' },
  { key: 'notify_new_message', label: 'Neue Nachrichten', description: 'Hinweise auf neue Nachrichten im persönlichen Portal.' },
  { key: 'notify_signature_required', label: 'Unterschriften und Dokumente', description: 'Offene Unterschriften, bestätigte Signaturen und Dokumentenanfragen zur Unterschrift.' },
  { key: 'notify_service_record_ready', label: 'Freigegebene Leistungsnachweise', description: 'Hinweise, sobald ein Leistungsnachweis im Portal bereitsteht.' },
];

function PreferencesEditor({ settings, roleKey, disabled, reload }: {
  settings: TenantNotificationSettings; roleKey: RoleKey | null; disabled: boolean; reload: () => Promise<void>;
}) {
  const text = useAuroraAdaptiveText();
  const [baseline, setBaseline] = useState(settings);
  const [draft, setDraft] = useState<TenantPushPreferences>(settings);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const submitting = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { setBaseline(settings); setDraft(settings); setError(null); setSaved(false); }, [settings]);
  const dirty = TENANT_PUSH_SETTING_KEYS.some(key => draft[key] !== baseline[key]);
  const locked = disabled || saving;
  const change = (key: TenantPushSettingKey, value: boolean) => {
    if (disabled || submitting.current) return;
    setDraft(current => ({ ...current, [key]: value })); setSaved(false); setError(null);
  };
  const save = async () => {
    if (disabled || submitting.current || !dirty) return;
    submitting.current = true; setSaving(true); setError(null); setSaved(false);
    const patch: Partial<TenantPushPreferences> = {};
    for (const key of TENANT_PUSH_SETTING_KEYS) {
      // First creation saves exactly the choices displayed in this form.
      if (!baseline.exists || draft[key] !== baseline[key]) patch[key] = draft[key];
    }
    try {
      const result = await saveTenantNotificationSettings(settings.tenantId, patch, roleKey);
      if (!mounted.current) return;
      if (!result.ok) { setError(result.error); return; }
      setBaseline(result.data); setDraft(result.data); setSaved(true);
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : 'Push-Einstellungen konnten nicht gespeichert werden.');
    } finally {
      submitting.current = false;
      if (mounted.current) setSaving(false);
    }
  };
  const row = (key: TenantPushSettingKey, label: string, description: string) => (
    <View key={key} style={styles.row}>
      <View style={styles.copy}>
        <Text style={[styles.label, { color: text.primary }]}>{label}</Text>
        <Text style={[styles.description, { color: text.secondary }]}>{description}</Text>
      </View>
      <Switch accessibilityLabel={label} value={draft[key]} disabled={locked} onValueChange={value => change(key, value)} />
    </View>
  );
  return (
    <View style={styles.stack}>
      {error ? <ErrorState message={error} /> : null}
      {saved ? <SuccessState message="Push-Einstellungen gespeichert." /> : null}
      <SectionPanel title="Push für Ihren Mandanten" subtitle="Zentrale Freigabe für Mitarbeitenden- und Klientenportal.">
        <Text style={[styles.description, { color: text.secondary }]}>
          Aktuell gespeichert: {baseline.push_notifications_enabled ? 'Push ist für diesen Mandanten freigegeben.' : 'Push ist für diesen Mandanten ausgeschaltet.'}
        </Text>
        {row('push_notifications_enabled', 'Push-Benachrichtigungen aktivieren', 'Schaltet den Push-Versand für diesen Mandanten ein oder aus. Die Ereignisauswahl bleibt beim Ausschalten erhalten.')}
        <Text style={[styles.description, { color: text.secondary }]}>
          Empfang setzt ein freigegebenes Portalkonto und die Benachrichtigungsberechtigung auf dem jeweiligen Gerät voraus.
        </Text>
      </SectionPanel>
      <SectionPanel title="Ereignisse auswählen" subtitle="Diese Optionen gelten zusätzlich zur zentralen Freigabe.">
        {eventOptions.map(option => row(option.key, option.label, option.description))}
      </SectionPanel>
      <View style={styles.actions}>
        <Text style={[styles.description, { color: text.secondary }]}>{dirty ? 'Änderungen sind noch nicht gespeichert.' : 'Die angezeigten Einstellungen entsprechen dem gespeicherten Stand.'}</Text>
        <PremiumButton title="Push-Einstellungen speichern" onPress={() => void save()} loading={saving} disabled={disabled || !dirty} fullWidth />
        <PremiumButton title="Gespeicherten Stand neu laden" variant="secondary" onPress={() => { if (!submitting.current) void reload(); }} loading={disabled} disabled={locked} fullWidth />
      </View>
    </View>
  );
}

export function TenantNotificationSettingsScreen() {
  const tenantId = useServiceTenantId();
  const { can, check, roleKey, roleLabel } = usePermissions();
  const allowed = can(TENANT_SETTINGS_PERMISSION);
  const query = useAsyncQuery(
    () => tenantId ? fetchTenantNotificationSettings(tenantId, roleKey) : Promise.resolve({ ok: false as const, error: 'Kein Mandant.' }),
    [tenantId, roleKey, allowed],
    { enabled: !!tenantId && allowed, queryKey: `${tenantId ?? ''}:${roleKey ?? ''}`, refreshOnAppFocus: false },
  );
  return (
    <SettingsScreenFrame title="Push-Benachrichtigungen" subtitle="Mandantenweite Freigabe und Ereignisauswahl">
      <View style={styles.column}>
        {!allowed ? <LockedActionBanner message={check(TENANT_SETTINGS_PERMISSION).reason ?? 'Keine Berechtigung für Mandanteneinstellungen.'} roleLabel={roleLabel} />
          : !tenantId ? <ErrorState message="Kein Mandant verfügbar. Bitte erneut anmelden." />
            : query.error && !query.data ? <ErrorState message={query.error} onRetry={query.refresh} />
              : !query.data ? <LoadingState message="Push-Einstellungen werden geladen…" />
                : <>
                  {query.refreshError ? <ErrorState message={query.refreshError} onRetry={query.refresh} /> : null}
                  <PreferencesEditor key={`${tenantId}:${roleKey}`} settings={query.data} roleKey={roleKey} disabled={query.refreshing} reload={query.refresh} />
                </>}
      </View>
    </SettingsScreenFrame>
  );
}

const styles = StyleSheet.create({
  column: { width: '100%', maxWidth: 840, alignSelf: 'center', gap: careSpacing.md },
  stack: { width: '100%', gap: careSpacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: careSpacing.md, paddingVertical: careSpacing.md, width: '100%' },
  copy: { flex: 1, minWidth: 0, gap: careSpacing.xs },
  label: { fontSize: 16, lineHeight: 24, fontWeight: '700' },
  description: { fontSize: 15, lineHeight: 23 },
  actions: { gap: careSpacing.md, width: '100%' },
});
