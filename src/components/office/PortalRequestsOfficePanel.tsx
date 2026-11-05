import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GlassCard } from '@/design/components/GlassCard';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { resolveGalaxyTypography, noBreakTextProps } from '@/design/tokens/responsiveTypography';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { useTenantPortalRequests } from '@/hooks/useTenantPortalRequests';
import { resolvePortalRequestTypeLabel } from '@/lib/portal/assist';
import { LoadingState } from '@/components/ui';
import { PremiumButton } from '@/components/ui/PremiumButton';
import { formatDateTime } from '@/lib/formatters/dateTimeFormatters';
import { useFlowRouter } from '@/hooks/useFlowRouter';

const STATUS_LABELS = { offen: 'Offen', in_bearbeitung: 'In Bearbeitung', erledigt: 'Erledigt',
  abgelehnt: 'Abgelehnt', zurueckgestellt: 'Zurückgestellt' };

type PortalRequestsOfficePanelProps = {
  tenantId: string;
  clientId?: string;
};

/** Office: recent portal requests for tenant (RLS office.access). */
export function PortalRequestsOfficePanel({ tenantId, clientId }: PortalRequestsOfficePanelProps) {
  const { requests, loading, error, refresh } = useTenantPortalRequests(tenantId, true, clientId);
  const [visibleCount, setVisibleCount] = useState(10);
  const router = useFlowRouter();
  useEffect(() => { setVisibleCount(10); }, [tenantId, clientId]);
  const text = useAuroraAdaptiveText();
  const { width } = useDeviceClass();
  const type = resolveGalaxyTypography(width);

  if (loading && requests.length === 0) {
    return <LoadingState message="Portal-Anfragen werden geladen…" />;
  }

  return (
    <View style={styles.container}>
      {error ? <View style={styles.container}>
        <Text accessibilityRole="alert" style={[type.body, { color: text.primary }]}>{error}</Text>
        <PremiumButton title="Erneut laden" variant="secondary" onPress={() => { void refresh(); }} />
      </View> : null}
      {!error && requests.length === 0 ? (
        <GlassCard>
          <Text style={[type.body, { color: text.secondary }]}>Keine offenen Portal-Anfragen.</Text>
        </GlassCard>
      ) : (
        requests.slice(0, visibleCount).map((request) => (
          <GlassCard key={request.id}>
            <Text style={[type.body, { color: text.primary, fontWeight: '600' }]} {...noBreakTextProps}>
              {request.title}
            </Text>
            <Text style={[type.caption, { color: text.secondary }]}>
              {request.clientName || 'Klientenportal'} · {formatDateTime(request.createdAt)}
            </Text>
            <Text style={[type.caption, { color: text.secondary }]}>
              {resolvePortalRequestTypeLabel(request.requestType)} · {STATUS_LABELS[request.status] ?? request.status}
            </Text>
            <Text selectable style={[type.body, styles.description, { color: text.primary }]}>
              {request.description || String(request.payload.nachricht || request.title)}
            </Text>
            {request.officeThreadId ? <PremiumButton title="Nachricht öffnen" variant="secondary"
              accessibilityLabel={`Nachricht zu ${request.title} öffnen`}
              onPress={() => router.push(`/office/messages?audience=clients&thread=${encodeURIComponent(request.officeThreadId!)}` as never)} /> : null}
          </GlassCard>
        ))
      )}
      {requests.length > visibleCount ? <PremiumButton
        title={`Weitere Anfragen anzeigen (${requests.length - visibleCount})`} variant="secondary"
        onPress={() => setVisibleCount(value => value + 10)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: careSpacing.sm,
  },
  description: { marginVertical: careSpacing.sm },
});
