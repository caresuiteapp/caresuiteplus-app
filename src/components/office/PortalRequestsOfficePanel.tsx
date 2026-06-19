import { StyleSheet, Text, View } from 'react-native';
import { GlassCard } from '@/design/components/GlassCard';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { resolveGalaxyTypography, noBreakTextProps } from '@/design/tokens/responsiveTypography';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { useTenantPortalRequests } from '@/hooks/useTenantPortalRequests';
import { resolvePortalRequestTypeLabel } from '@/lib/portal/assist';
import { LoadingState } from '@/components/ui';

type PortalRequestsOfficePanelProps = {
  tenantId: string;
  clientId?: string;
};

/** Office: recent portal requests for tenant (RLS office.access). */
export function PortalRequestsOfficePanel({ tenantId, clientId }: PortalRequestsOfficePanelProps) {
  const { requests, loading, error } = useTenantPortalRequests(tenantId);
  const text = useAuroraAdaptiveText();
  const { width } = useDeviceClass();
  const type = resolveGalaxyTypography(width);

  const filtered = clientId
    ? requests.filter((r) => r.clientId === clientId)
    : requests;

  if (loading) {
    return <LoadingState message="Portal-Anfragen werden geladen…" />;
  }

  return (
    <View style={styles.container}>
      <Text style={[type.caption, styles.eyebrow, { color: text.muted }]}>PORTAL-ANFRAGEN</Text>
      {error ? (
        <Text style={[type.caption, { color: text.secondary }]}>{error}</Text>
      ) : filtered.length === 0 ? (
        <GlassCard>
          <Text style={[type.body, { color: text.secondary }]}>Keine offenen Portal-Anfragen.</Text>
        </GlassCard>
      ) : (
        filtered.slice(0, 5).map((request) => (
          <GlassCard key={request.id}>
            <Text style={[type.body, { color: text.primary, fontWeight: '600' }]} {...noBreakTextProps}>
              {request.title}
            </Text>
            <Text style={[type.caption, { color: text.muted }]}>
              {resolvePortalRequestTypeLabel(request.requestType)} · {request.status}
            </Text>
          </GlassCard>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: careSpacing.sm,
  },
  eyebrow: {
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
});
