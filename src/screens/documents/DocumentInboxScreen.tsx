import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CareLightPageShell } from '@/components/layout';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumBadge,
  PremiumButton,
  PremiumCard,
} from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import {
  DOCUMENT_INBOX_SOURCE_LABELS,
  DOCUMENT_INBOX_STATUS_LABELS,
  fetchInboxItems,
} from '@/lib/documents/documentInbox';
import { colors, spacing, typography } from '@/theme';

export function DocumentInboxScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { can, check, roleLabel } = usePermissions();

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchInboxItems(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  if (!can('office.documents.view')) {
    return (
      <CareLightPageShell
        title="Dokumenteneingang"
        subtitle={roleLabel ?? 'Dokumente'}
        showBack
      >
        <PremiumCard>
          <Text style={styles.denied}>
            {check('office.documents.view').reason ?? 'Keine Berechtigung für Dokumenteneingang.'}
          </Text>
        </PremiumCard>
      </CareLightPageShell>
    );
  }

  if (query.loading && !query.data) {
    return (
      <CareLightPageShell title="Dokumenteneingang" subtitle="Wird geladen…" showBack>
        <LoadingState message="Eingang wird geladen…" />
      </CareLightPageShell>
    );
  }

  if (query.error && !query.data) {
    return (
      <CareLightPageShell title="Dokumenteneingang" subtitle="Fehler" showBack>
        <ErrorState message={query.error} onRetry={query.refresh} />
      </CareLightPageShell>
    );
  }

  const items = query.data ?? [];

  return (
    <CareLightPageShell
      title="Dokumenteneingang"
      subtitle="Mehr → Dokumente → Dokumenteneingang"
      showBack
      rightSlot={
        <PremiumButton
          title="Office-Dokumente"
          size="sm"
          variant="secondary"
          onPress={() => router.push('/office/documents' as never)}
        />
      }
    >
      <PremiumCard>
        <Text style={styles.hint}>
          Upload, Scan, Zuordnung und OCR-Vorbereitung — externe OCR und Gesundheitsdaten nur mit
          Freigabe. Unsichere Zuordnungen erzeugen Prüfaufträge.
        </Text>
      </PremiumCard>

      {items.length === 0 ? (
        <EmptyState
          title="Eingang leer"
          message="Hochgeladene Dokumente erscheinen hier zur Klassifizierung und Verknüpfung."
        />
      ) : (
        <View style={styles.list}>
          {items.map((item) => (
            <PremiumCard key={item.id}>
              <Text style={styles.fileName}>{item.title ?? item.fileName}</Text>
              <Text style={styles.meta}>
                {DOCUMENT_INBOX_SOURCE_LABELS[item.source]} · {item.fileName}
              </Text>
              <View style={styles.badgeRow}>
                <PremiumBadge
                  label={DOCUMENT_INBOX_STATUS_LABELS[item.status]}
                  variant={
                    item.status === 'review_required'
                      ? 'orange'
                      : item.status === 'linked' || item.status === 'archived'
                        ? 'green'
                        : 'muted'
                  }
                />
                {item.containsHealthData ? (
                  <PremiumBadge label="Gesundheitsdaten" variant="red" />
                ) : null}
              </View>
            </PremiumCard>
          ))}
        </View>
      )}
    </CareLightPageShell>
  );
}

const styles = StyleSheet.create({
  hint: { ...typography.caption, color: colors.textSecondary },
  denied: { ...typography.body, color: colors.textSecondary },
  list: { gap: spacing.sm, marginTop: spacing.md },
  fileName: { ...typography.h3, marginBottom: spacing.xs },
  meta: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.sm },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
