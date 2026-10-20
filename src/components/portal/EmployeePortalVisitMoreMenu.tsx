import { useMemo } from 'react';
import { View } from 'react-native';
import { PlatformModal } from '@/components/layout/platform/platformmodal';
import { PremiumButton, PremiumInput } from '@/components/ui';
import { useDeviceClass } from '@/hooks/platform/useDeviceClass';
import { isDesktopClass } from '@/lib/platform/breakpoints';
import { spacing } from '@/theme';

type EmployeePortalVisitMoreMenuProps = {
  visible: boolean;
  onClose: () => void;
  onOpenMap: () => void;
  onCall?: () => void;
  canReportNoShow?: boolean;
  showNoShowForm?: boolean;
  noShowNote?: string;
  onNoShowNoteChange?: (value: string) => void;
  onOpenNoShowForm?: () => void;
  onSubmitNoShow?: () => void;
  noShowLoading?: boolean;
};

export function EmployeePortalVisitMoreMenu({
  visible,
  onClose,
  onOpenMap,
  onCall,
  canReportNoShow = false,
  showNoShowForm = false,
  noShowNote = '',
  onNoShowNoteChange,
  onOpenNoShowForm,
  onSubmitNoShow,
  noShowLoading = false,
}: EmployeePortalVisitMoreMenuProps) {
  const deviceClass = useDeviceClass();
  const isMobile = !isDesktopClass(deviceClass);

  const bodyStyle = useMemo(() => ({ gap: spacing.sm }), []);

  return (
    <PlatformModal
      visible={visible}
      title="Mehr"
      subtitle="Weitere Aktionen"
      onClose={onClose}
      variant={isMobile ? 'bottomSheet' : 'center'}
      animationType={isMobile ? 'slide' : 'fade'}
      maxWidth={420}
      bodyStyle={bodyStyle}
    >
      <PremiumButton title="Karte / Route" variant="secondary" fullWidth onPress={onOpenMap} />
      {onCall ? (
        <PremiumButton title="Anrufen" variant="ghost" fullWidth onPress={onCall} />
      ) : null}
      {canReportNoShow && !showNoShowForm ? (
        <PremiumButton
          title="Nicht angetroffen"
          variant="ghost"
          fullWidth
          onPress={onOpenNoShowForm}
        />
      ) : null}
      {showNoShowForm ? (
        <View style={bodyStyle}>
          <PremiumInput
            label="Begründung *"
            value={noShowNote}
            onChangeText={onNoShowNoteChange}
            multiline
          />
          <PremiumButton title="Melden" fullWidth loading={noShowLoading} onPress={onSubmitNoShow} />
        </View>
      ) : null}
    </PlatformModal>
  );
}
