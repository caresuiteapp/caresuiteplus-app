import { StyleSheet, Text, View } from 'react-native';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumBadge,
  PremiumCard,
  SectionPanel,
} from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { listClientServiceProfiles, listTenantClientServiceTypes } from '@/lib/client/clientServiceTypeService';
import { CLIENT_SERVICE_TYPE_LABELS } from '@/types/clientCore';
import { colors, spacing, typography } from '@/theme';

type Props = {
  clientId: string;
};

export function ClientServiceProfilesPanel({ clientId }: Props) {
  const tenantId = useServiceTenantId();

  const typesQuery = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return listTenantClientServiceTypes(tenantId);
    },
    [tenantId],
    { enabled: !!tenantId },
  );

  const profilesQuery = useAsyncQuery(
    () => {
      if (!tenantId || !clientId) return Promise.resolve({ ok: false as const, error: 'Keine ID.' });
      return listClientServiceProfiles(tenantId, clientId);
    },
    [tenantId, clientId],
    { enabled: !!tenantId && !!clientId },
  );

  const loading = typesQuery.loading || profilesQuery.loading;
  const error = typesQuery.error ?? profilesQuery.error;

  if (loading && !profilesQuery.data) {
    return <LoadingState message="Leistungsbereiche werden geladen…" />;
  }
  if (error && !profilesQuery.data) {
    return <ErrorState message={error} onRetry={() => { void profilesQuery.refresh(); void typesQuery.refresh(); }} />;
  }

  const profiles = profilesQuery.data ?? [];
  const tenantTypes = typesQuery.data ?? [];

  return (
    <View style={styles.panel}>
      <SectionPanel title="Leistungsbereiche">
        {profiles.length === 0 ? (
          <EmptyState
            title="Keine Leistungsbereiche konfiguriert"
            message="Leistungsarten werden bei der Aufnahme oder unter Stammdaten als Multi-Select hinterlegt. Mandantenvorlagen stehen unter Einstellungen bereit."
          />
        ) : (
          profiles.map((profile) => (
            <PremiumCard key={profile.id} style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.primary}>
                  {profile.serviceTypeName ??
                    CLIENT_SERVICE_TYPE_LABELS[profile.serviceTypeKey!] ??
                    profile.serviceTypeKey}
                </Text>
                {profile.isPrimary ? <PremiumBadge label="Primär" variant="cyan" /> : null}
              </View>
              <Text style={styles.secondary}>
                Status: {profile.status}
                {profile.startedOn ? ` · seit ${profile.startedOn}` : ''}
              </Text>
            </PremiumCard>
          ))
        )}
      </SectionPanel>
      <SectionPanel title="Mandanten-Leistungsarten (Vorlagen)">
        {tenantTypes.length === 0 ? (
          <EmptyState title="Keine Vorlagen" message="Leistungsart-Vorlagen werden beim ersten Zugriff automatisch angelegt." />
        ) : (
          tenantTypes.map((type) => (
            <PremiumCard key={type.id} style={styles.card}>
              <Text style={styles.primary}>{type.name}</Text>
              <Text style={styles.secondary}>{type.description ?? type.serviceTypeKey}</Text>
            </PremiumCard>
          ))
        )}
      </SectionPanel>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: spacing.md, paddingBottom: spacing.lg },
  card: { marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  primary: { ...typography.label },
  secondary: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
});
