import { ScrollView, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LockedActionBanner } from '@/components/permissions';
import { CareLightPageShell } from '@/components/layout';
import { KIMMessageDetailHero, TISecurityNotice } from '@/components/ti';
import {
  ErrorState,
  InfoBanner,
  LoadingState,
  PremiumButton,
  PremiumCard,
} from '@/components/ui';
import { useKIMMessageDetail } from '@/hooks/ti';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { requestKIMAttachmentImport } from '@/lib/ti';
import { TI_PREPARED_MESSAGE } from '@/lib/ti/tiModuleConfig';
import { colors, spacing, typography } from '@/theme';
import { useState } from 'react';

export function KIMMessageDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { can, check, roleLabel } = usePermissions();
  const { profile } = useAuth();
  const roleKey = profile?.roleKey ?? 'business_admin';
  const tenantId = useServiceTenantId();
  const { data, loading, error, refresh } = useKIMMessageDetail(id ?? '');
  const [importMessage, setImportMessage] = useState<string | null>(null);

  if (!can('ti.kim.view')) {
    return (
      <CareLightPageShell title="KIM-Nachricht">
        <LockedActionBanner message={check('ti.kim.view').reason ?? 'Keine Berechtigung.'} roleLabel={roleLabel} />
      </CareLightPageShell>
    );
  }

  if (loading && !data) {
    return (
      <CareLightPageShell title="KIM-Nachricht">
        <LoadingState message="Nachricht wird geladen…" />
      </CareLightPageShell>
    );
  }

  if (error && !data) {
    return (
      <CareLightPageShell title="KIM-Nachricht">
        <ErrorState message={error} onRetry={refresh} />
      </CareLightPageShell>
    );
  }

  if (!data) return null;

  const handleImport = async (attachmentId: string) => {
    if (!tenantId) return;
    const result = await requestKIMAttachmentImport(
      tenantId,
      { attachmentId, confirmed: true },
      profile?.roleKey,
      profile?.displayName ?? 'System',
    );
    setImportMessage(result.ok ? 'Anhang importiert.' : result.error);
    if (result.ok) await refresh();
  };

  return (
    <CareLightPageShell title="KIM-Nachricht" subtitle={data.subject}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <KIMMessageDetailHero message={data} roleKey={roleKey} />

        <InfoBanner variant="warning" title="TI preparedOnly" message={TI_PREPARED_MESSAGE} />

        <PremiumCard accentColor={colors.cyan}>
          <Text style={styles.body}>{data.body}</Text>
        </PremiumCard>

        {data.attachments.length > 0 ? (
          <>
            <Text style={styles.section}>Anhänge</Text>
            {data.attachments.map((att) => (
              <PremiumCard key={att.id} accentColor={colors.cyanSoft}>
                <Text style={styles.attName}>{att.fileName}</Text>
                <Text style={styles.attMeta}>
                  {(att.sizeBytes / 1024).toFixed(0)} KB · {att.mimeType}
                </Text>
                {att.suggestedAssignment ? (
                  <Text style={styles.suggestion}>
                    KI-Vorschlag (nicht bindend): {att.suggestedAssignment}
                  </Text>
                ) : null}
                <Text style={styles.attStatus}>Status: {att.importStatus}</Text>
                {att.importStatus === 'pending' && can('ti.kim.manage') ? (
                  <PremiumButton
                    title="Import manuell bestätigen"
                    onPress={() => handleImport(att.id)}
                    fullWidth
                  />
                ) : null}
              </PremiumCard>
            ))}
          </>
        ) : null}

        {importMessage ? <Text style={styles.importMsg}>{importMessage}</Text> : null}

        <TISecurityNotice compact />
        <PremiumButton
          title="Dokument zuordnen"
          variant="secondary"
          onPress={() => router.push('/business/ti/documents' as never)}
        />
      </ScrollView>
    </CareLightPageShell>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, paddingBottom: spacing.xxl },
  body: { ...typography.body, lineHeight: 22 },
  section: { ...typography.bodyStrong, color: colors.cyan },
  attName: { ...typography.bodyStrong },
  attMeta: { ...typography.caption, color: colors.textSecondary },
  suggestion: { ...typography.caption, color: colors.warning, marginTop: spacing.xs },
  attStatus: { ...typography.caption, marginTop: spacing.xs },
  importMsg: { ...typography.body, color: colors.success },
});
