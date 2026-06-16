import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import { InfoBanner, PremiumCard } from '@/components/ui';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { usePermissions } from '@/hooks/usePermissions';
import {
  COMMUNICATION_PREPARED_NOTICE,
  getCommunicationProviderConfigsForTenant,
  getPreparedChannelTemplates,
  listSupportedChannels,
} from '@/lib/communication';
import {
  COMMUNICATION_CHANNEL_LABELS,
  COMMUNICATION_PROVIDER_LABELS,
  COMMUNICATION_USE_CASE_LABELS,
} from '@/types/communication/channels';
import { colors, spacing, typography } from '@/theme';

export function CommunicationChannelSettingsScreen() {
  const tenantId = useServiceTenantId();
  const { can, check, roleLabel } = usePermissions();
  const isAdmin = can('connect.configure');

  if (!can('communication.manage_settings')) {
    return (
      <ScreenShell title="Kanal-Einstellungen" subtitle={roleLabel ?? 'Betrieb'}>
        <LockedActionBanner
          message={check('communication.manage_settings').reason ?? 'Keine Berechtigung.'}
          roleLabel={roleLabel}
        />
      </ScreenShell>
    );
  }

  if (!tenantId) {
    return (
      <ScreenShell title="Kanal-Einstellungen">
        <InfoBanner title="Mandant" message="Kein Mandant ausgewählt." />
      </ScreenShell>
    );
  }

  const providers = getCommunicationProviderConfigsForTenant(tenantId, isAdmin);
  const templates = getPreparedChannelTemplates(tenantId);
  const channels = listSupportedChannels();

  return (
    <ScreenShell
      title="Kanal-Einstellungen"
      subtitle="E-Mail, SMS, WhatsApp, Push, Telefonie — Prepare-Only"
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <InfoBanner title="Vorbereitung" message={COMMUNICATION_PREPARED_NOTICE} />
        <InfoBanner
          title="Sicherheit"
          message="Zugangsdaten werden ausschließlich serverseitig hinterlegt. Es werden keine Nachrichten versendet."
        />

        <Text style={styles.section}>Kanäle</Text>
        {channels.map((channel) => (
          <PremiumCard key={channel} accentColor={colors.cyanSoft}>
            <Text style={styles.cardTitle}>{COMMUNICATION_CHANNEL_LABELS[channel]}</Text>
            <Text style={styles.meta}>Status: Vorbereitet · Kein Live-Versand</Text>
          </PremiumCard>
        ))}

        <Text style={styles.section}>Provider</Text>
        {providers.map((provider) => (
          <PremiumCard key={`${provider.providerKey}-${provider.channel}`}>
            <Text style={styles.cardTitle}>
              {COMMUNICATION_PROVIDER_LABELS[provider.providerKey]} ·{' '}
              {COMMUNICATION_CHANNEL_LABELS[provider.channel]}
            </Text>
            <Text style={styles.meta}>Status: {provider.status}</Text>
            <Text style={styles.meta}>
              Vault: {provider.credentialReference ?? '—'}
            </Text>
            {provider.channel === 'whatsapp_business' ? (
              <Text style={styles.meta}>
                WhatsApp-Freigabe: {provider.whatsappApproved ? 'Ja' : 'Nein — Versand blockiert'}
              </Text>
            ) : null}
          </PremiumCard>
        ))}

        <Text style={styles.section}>Vorlagen (Use Cases)</Text>
        {templates.map((template) => (
          <PremiumCard key={template.id}>
            <Text style={styles.cardTitle}>{template.name}</Text>
            <Text style={styles.meta}>
              {COMMUNICATION_USE_CASE_LABELS[template.useCase]} · {template.status}
            </Text>
          </PremiumCard>
        ))}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Alle Versandfunktionen bleiben blockiert bis zur produktiven Freischaltung.
          </Text>
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.sm, paddingBottom: spacing.xxl },
  section: { ...typography.bodyStrong, marginTop: spacing.md },
  cardTitle: { ...typography.bodyStrong, marginBottom: spacing.xs },
  meta: { ...typography.caption, color: colors.textSecondary },
  footer: { marginTop: spacing.md },
  footerText: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
});
