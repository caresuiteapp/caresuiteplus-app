import { StyleSheet, Text, View } from 'react-native';
import { PortalGlassModal } from '@/components/portal/assist/PortalGlassModal';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { resolveGalaxyTypography, noBreakTextProps } from '@/design/tokens/responsiveTypography';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { resolvePortalRequestTypeLabel } from '@/lib/portal/assist';
import type { PortalRequest } from '@/types/portal/assist';

type PortalRequestDrawerProps = {
  request: PortalRequest | null;
  visible: boolean;
  onClose: () => void;
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('de-DE');
  } catch {
    return iso;
  }
}

const STATUS_LABELS: Record<string, string> = {
  offen: 'Offen',
  in_bearbeitung: 'In Bearbeitung',
  erledigt: 'Erledigt',
  abgelehnt: 'Abgelehnt',
  zurueckgestellt: 'Zurückgestellt',
};

/** Read-only request detail content — shared by drawer and open-requests modal. */
export function PortalRequestDetail({ request }: { request: PortalRequest }) {
  const text = useAuroraAdaptiveText();
  const { width } = useDeviceClass();
  const type = resolveGalaxyTypography(width);

  return (
    <View style={styles.detail}>
      <Text style={[type.caption, { color: text.muted }]}>ANFRAGE</Text>
      <Text style={[type.cardTitle, { color: text.primary }]} {...noBreakTextProps}>
        {request.title}
      </Text>
      <Text style={[type.body, { color: text.secondary }]}>
        {resolvePortalRequestTypeLabel(request.requestType)} ·{' '}
        {STATUS_LABELS[request.status] ?? request.status}
      </Text>
      {request.description ? (
        <Text style={[type.body, { color: text.secondary }]}>{request.description}</Text>
      ) : null}
      <Text style={[type.caption, { color: text.muted }]}>
        Erstellt: {formatDate(request.createdAt)}
      </Text>
    </View>
  );
}

/** Read-only request detail overlay. */
export function PortalRequestDrawer({ request, visible, onClose }: PortalRequestDrawerProps) {
  if (!visible || !request) return null;

  return (
    <PortalGlassModal visible={visible} title="Anfrage" onClose={onClose}>
      <PortalRequestDetail request={request} />
    </PortalGlassModal>
  );
}

const styles = StyleSheet.create({
  detail: {
    gap: careSpacing.sm,
  },
});
