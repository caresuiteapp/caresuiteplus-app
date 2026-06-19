import { ScrollView, StyleSheet, View } from 'react-native';
import { PlatformModal } from '@/components/layout/platform';
import { TripDetailSummaryPanel } from '@/components/assist/TripDetailSummaryPanel';
import { auroraGlass } from '@/design/tokens/auroraGlass';
import { careRadius } from '@/design/tokens/radius';
import { careSpacing } from '@/design/tokens/spacing';
import { moduleColor } from '@/design/tokens/modules';

type TripDetailGlassModalProps = {
  visible: boolean;
  tripId: string | null;
  title?: string;
  onClose: () => void;
};

/** Centered glass modal for trip detail — list stays visible behind overlay. */
export function TripDetailGlassModal({
  visible,
  tripId,
  title = 'Fahrt',
  onClose,
}: TripDetailGlassModalProps) {
  const assistAccent = moduleColor('assist');

  return (
    <PlatformModal
      visible={visible}
      onClose={onClose}
      title={title}
      subtitle="Fahrtdetails"
      maxWidth={720}
      maxHeightRatio={0.88}
      glowColor={assistAccent}
      bodyStyle={styles.modalBody}
    >
      <View style={styles.body}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {tripId ? (
            <View style={styles.detailPanel}>
              <TripDetailSummaryPanel tripId={tripId} embedded />
            </View>
          ) : null}
        </ScrollView>
      </View>
    </PlatformModal>
  );
}

const styles = StyleSheet.create({
  modalBody: {
    paddingTop: 0,
    gap: 0,
  },
  body: {
    gap: careSpacing.md,
  },
  scroll: {
    flexGrow: 0,
    maxHeight: 560,
  },
  scrollContent: {
    flexGrow: 1,
  },
  detailPanel: {
    backgroundColor: auroraGlass.modal,
    borderRadius: careRadius.lg,
    borderWidth: 1,
    borderColor: auroraGlass.borderStrong,
    overflow: 'hidden',
  },
});
