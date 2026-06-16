import { ScrollView, StyleSheet, Text } from 'react-native';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import { InfoBanner, PremiumCard } from '@/components/ui';
import { useConnectCatalog } from '@/hooks/useConnectCatalog';
import { usePermissions } from '@/hooks/usePermissions';
import { CONNECT_SECRETS_SERVER_SIDE } from '@/lib/connect';
import { colors, spacing, typography } from '@/theme';

export function ConnectProviderConfigScreen() {
  const { can, check, roleLabel } = usePermissions();
  const { getProviderPlaceholders } = useConnectCatalog();
  const placeholders = getProviderPlaceholders();

  if (!can('connect.configure')) {
    return (
      <ScreenShell title="Anbieter-Konfiguration" subtitle={roleLabel ?? 'Betrieb'}>
        <LockedActionBanner
          message={check('connect.configure').reason ?? 'Keine Berechtigung.'}
          roleLabel={roleLabel}
        />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title="Anbieter-Konfiguration"
      subtitle="Mandantenspezifische Connect-Provider"
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <InfoBanner
          title="Platzhalter-Konfiguration"
          message="Diese Liste zeigt vorbereitete Anbieter-Slots pro Mandant. Es werden keine Zugangsdaten angezeigt."
        />
        <InfoBanner title="Sicherheit" message={CONNECT_SECRETS_SERVER_SIDE} />

        {placeholders.map((entry) => (
          <PremiumCard key={entry.id} accentColor={colors.cyanSoft}>
            <Text style={styles.title}>{entry.label}</Text>
            <Text style={styles.meta}>Integration: {entry.integrationKey}</Text>
            <Text style={styles.meta}>Mandant: {entry.tenantId}</Text>
            <Text style={styles.meta}>Status: {entry.status === 'not_configured' ? 'Nicht konfiguriert' : 'Platzhalter'}</Text>
            <Text style={styles.meta}>Vault-Referenz: {entry.vaultReference ?? '—'}</Text>
            <Text style={styles.meta}>
              Aktualisiert: {new Date(entry.updatedAt).toLocaleDateString('de-DE')}
            </Text>
          </PremiumCard>
        ))}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.sm, paddingBottom: spacing.xxl },
  title: { ...typography.bodyStrong, marginBottom: spacing.xs },
  meta: { ...typography.caption, color: colors.textSecondary },
});
