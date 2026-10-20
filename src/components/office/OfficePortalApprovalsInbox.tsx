import { StyleSheet, Text, View } from 'react-native';
import {
  EmptyState,
  LoadingState,
  PremiumBadge,
  PremiumCard,
  SectionPanel,
} from '@/components/ui';
import {
  listPendingPortalApprovals,
  type PortalApprovalItem,
} from '@/lib/portal/officePortalApprovalService';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { colors, spacing, typography } from '@/theme';

const KIND_LABELS: Record<PortalApprovalItem['kind'], string> = {
  proof: 'Nachweis',
  upload: 'Upload',
  access_request: 'Zugang',
};

type Props = {
  clientId?: string;
  limit?: number;
};

/** Office inbox — pending portal proofs, uploads and access requests. */
export function OfficePortalApprovalsInbox({ clientId, limit = 20 }: Props) {
  const tenantId = useServiceTenantId();

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return listPendingPortalApprovals(tenantId, { clientId, limit });
    },
    [tenantId, clientId, limit],
    { enabled: !!tenantId },
  );

  if (query.loading && !query.data) {
    return <LoadingState message="Portal-Freigaben werden geladen…" />;
  }

  const items = query.data ?? [];

  return (
    <SectionPanel title="Portal-Freigaben (Inbox)">
      {items.length === 0 ? (
        <EmptyState
          title="Keine offenen Freigaben"
          message="Nachweise zur Prüfung, Portal-Uploads und Zugangsanfragen erscheinen hier."
        />
      ) : (
        items.map((item) => (
          <PremiumCard key={`${item.kind}-${item.id}`} style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.primary}>{item.title}</Text>
              <PremiumBadge label={KIND_LABELS[item.kind]} variant="orange" />
            </View>
            <Text style={styles.secondary}>{item.subtitle}</Text>
            <Text style={styles.secondary}>
              {new Date(item.createdAt).toLocaleString('de-DE')} · {item.status}
            </Text>
          </PremiumCard>
        ))
      )}
    </SectionPanel>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  primary: { ...typography.label, flex: 1 },
  secondary: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
});
