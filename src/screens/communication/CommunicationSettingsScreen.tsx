import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import { LoadingState, PremiumButton } from '@/components/ui';
import {
  getCommunicationSettings,
  updateCommunicationSettings,
} from '@/features/communication/communication.service';
import { useCommunicationPermissions } from '@/hooks/communication';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { colors, spacing, typography } from '@/theme';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';

export function CommunicationSettingsScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const perms = useCommunicationPermissions();
  const [saving, setSaving] = useState(false);
  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return getCommunicationSettings(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  if (!perms.canManageSettings) {
    return (
      <ScreenShell title="Einstellungen">
        <LockedActionBanner message="Keine Berechtigung für Kommunikationseinstellungen." />
      </ScreenShell>
    );
  }

  if (query.loading || !query.data) {
    return (
      <ScreenShell title="Einstellungen">
        <LoadingState message="Einstellungen werden geladen…" />
      </ScreenShell>
    );
  }

  const settings = query.data;

  const toggle = async (key: keyof typeof settings, value: boolean) => {
    if (!tenantId) return;
    setSaving(true);
    await updateCommunicationSettings(tenantId, { [key]: value }, profile?.roleKey);
    await query.refresh();
    setSaving(false);
  };

  const rows: { key: keyof typeof settings; label: string }[] = [
    { key: 'centerEnabled', label: 'Nachrichtenportal aktiv' },
    { key: 'clientPortalEnabled', label: 'Klient:innenportal Nachrichten' },
    { key: 'employeePortalEnabled', label: 'Mitarbeiter:innenportal Nachrichten' },
    { key: 'relativePortalEnabled', label: 'Angehörigenportal Nachrichten' },
    { key: 'voiceMessagesEnabled', label: 'Sprachnachrichten erlauben' },
    { key: 'attachmentsEnabled', label: 'Anhänge erlauben' },
    { key: 'emojisEnabled', label: 'Emojis erlauben' },
    { key: 'reactionsEnabled', label: 'Reaktionen erlauben' },
    { key: 'internalNotesEnabled', label: 'Interne Notizen erlauben' },
    { key: 'realtimeEnabled', label: 'Realtime aktiv' },
    { key: 'showReadReceipts', label: 'Lesestatus anzeigen' },
    { key: 'showTypingIndicator', label: 'Schreibindikator anzeigen' },
  ];

  return (
    <ScreenShell title="Einstellungen" subtitle="Tenant-Kommunikation">
      <View style={styles.list}>
        {rows.map((row) => (
          <View key={row.key} style={styles.row}>
            <Text style={styles.label}>{row.label}</Text>
            <Switch
              value={!!settings[row.key]}
              onValueChange={(v) => toggle(row.key, v)}
              disabled={saving}
              trackColor={{ true: colors.cyan, false: colors.bgPanel }}
            />
          </View>
        ))}
        <PremiumButton title="Aktualisieren" variant="secondary" onPress={query.refresh} />
        <PremiumButton
          title="Kanal-Einstellungen (E-Mail, SMS, Push…)"
          variant="secondary"
          onPress={() => router.push('/business/messages/channels' as never)}
        />
      </View>
    </ScreenShell>
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
  label: { ...typography.body, color: colors.textPrimary, flex: 1, paddingRight: spacing.md },
});
