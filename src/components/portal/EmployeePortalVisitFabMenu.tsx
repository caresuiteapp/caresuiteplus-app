import { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { PlatformModal } from '@/components/layout/platform/platformmodal';
import { PremiumButton } from '@/components/ui';
import { useDeviceClass } from '@/hooks/platform/useDeviceClass';
import { isDesktopClass } from '@/lib/platform/breakpoints';
import { spacing } from '@/theme';

const FAB_SIZE = 48;
const BOTTOM_BAR_HEIGHT = 64;

type FabAction = {
  key: string;
  label: string;
  onPress: () => void;
};

type EmployeePortalVisitFabMenuProps = {
  actions: FabAction[];
};

export function EmployeePortalVisitFabMenu({ actions }: EmployeePortalVisitFabMenuProps) {
  const deviceClass = useDeviceClass();
  const isMobile = !isDesktopClass(deviceClass);
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  const fabBottom = Math.max(insets.bottom, spacing.sm) + BOTTOM_BAR_HEIGHT;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        fab: {
          position: 'absolute',
          right: spacing.md,
          bottom: fabBottom,
          width: FAB_SIZE,
          height: FAB_SIZE,
          borderRadius: FAB_SIZE / 2,
          backgroundColor: '#056CE8',
          borderWidth: 1,
          borderColor: 'rgba(185,220,255,0.72)',
          alignItems: 'center',
          justifyContent: 'center',
          ...Platform.select({
            web: { zIndex: 25, cursor: 'pointer' as const },
            default: {
              elevation: 4,
              shadowColor: '#000',
              shadowOpacity: 0.2,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 2 },
            },
          }),
        },
        menu: { gap: spacing.xs },
      }),
    [fabBottom],
  );

  return (
    <>
      <Pressable
        style={styles.fab}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Schnellaktionen"
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </Pressable>
      <PlatformModal
        visible={open}
        title="Schnellaktionen"
        onClose={() => setOpen(false)}
        variant={isMobile ? 'bottomSheet' : 'center'}
        animationType={isMobile ? 'slide' : 'fade'}
        maxWidth={400}
      >
        <View style={styles.menu}>
          {actions.map((action) => (
            <PremiumButton
              key={action.key}
              title={action.label}
              variant="ghost"
              onPress={() => {
                setOpen(false);
                action.onPress();
              }}
            />
          ))}
        </View>
      </PlatformModal>
    </>
  );
}
