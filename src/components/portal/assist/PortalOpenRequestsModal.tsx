import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PortalGlassModal } from '@/components/portal/assist/PortalGlassModal';
import { PortalEmptyState } from '@/components/portal/assist/PortalEmptyState';
import { PortalRequestDetail } from '@/components/portal/assist/PortalRequestDrawer';
import { GlassCard } from '@/design/components/GlassCard';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { resolveGalaxyTypography, noBreakTextProps } from '@/design/tokens/responsiveTypography';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { resolvePortalRequestTypeLabel } from '@/lib/portal/assist';
import type { PortalRequest } from '@/types/portal/assist';

type PortalOpenRequestsModalProps = {
  visible: boolean;
  requests: PortalRequest[];
  onClose: () => void;
  onNewRequest?: () => void;
};

/** Glass modal listing open portal requests — detail opens in-place. */
export function PortalOpenRequestsModal({
  visible,
  requests,
  onClose,
  onNewRequest,
}: PortalOpenRequestsModalProps) {
  const text = useAuroraAdaptiveText();
  const { width } = useDeviceClass();
  const type = resolveGalaxyTypography(width);
  const [selectedRequest, setSelectedRequest] = useState<PortalRequest | null>(null);

  useEffect(() => {
    if (!visible) setSelectedRequest(null);
  }, [visible]);

  const handleClose = () => {
    setSelectedRequest(null);
    onClose();
  };

  const handleBack = () => setSelectedRequest(null);

  if (selectedRequest) {
    return (
      <PortalGlassModal visible={visible} title="Anfrage" onClose={handleBack}>
        <PortalRequestDetail request={selectedRequest} />
        <Pressable onPress={handleBack} style={styles.backLink}>
          <Text style={[type.caption, { color: '#FF9500', fontWeight: '600' }]}>Zurück zur Liste</Text>
        </Pressable>
      </PortalGlassModal>
    );
  }

  return (
    <PortalGlassModal
      visible={visible}
      title="Offene Anfragen"
      onClose={handleClose}
      primaryLabel={onNewRequest ? 'Anfrage stellen' : undefined}
      onPrimary={onNewRequest}
    >
      {requests.length === 0 ? (
        <PortalEmptyState message="Keine offenen Anfragen — hier erscheinen laufende Portal-Anfragen." />
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {requests.map((request) => (
            <Pressable key={request.id} onPress={() => setSelectedRequest(request)}>
              <GlassCard style={styles.item}>
                <Text style={[type.body, { color: text.primary, fontWeight: '600' }]} {...noBreakTextProps}>
                  {request.title}
                </Text>
                <Text style={[type.caption, { color: text.muted }]}>
                  {resolvePortalRequestTypeLabel(request.requestType)}
                </Text>
              </GlassCard>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </PortalGlassModal>
  );
}

const styles = StyleSheet.create({
  list: {
    maxHeight: 360,
  },
  listContent: {
    gap: careSpacing.sm,
  },
  item: {
    gap: careSpacing.xs,
  },
  backLink: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: careSpacing.xs,
  },
});
