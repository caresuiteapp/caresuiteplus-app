import { StyleSheet, Text, View } from 'react-native';
import { GlassCard } from '@/design/components/GlassCard';
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

/** Read-only request detail overlay. */
export function PortalRequestDrawer({ request, visible, onClose }: PortalRequestDrawerProps) {
  const text = useAuroraAdaptiveText();
  const { width } = useDeviceClass();
  const type = resolveGalaxyTypography(width);

  if (!visible || !request) return null;

  return (
    <View style={styles.overlay}>
      <GlassCard glow style={styles.drawer}>
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
        <Text style={[type.caption, styles.close, { color: '#FF9500' }]} onPress={onClose}>
          Schließen
        </Text>
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    marginTop: careSpacing.sm,
  },
  drawer: {
    gap: careSpacing.sm,
  },
  close: {
    fontWeight: '700',
    marginTop: careSpacing.sm,
  },
});
