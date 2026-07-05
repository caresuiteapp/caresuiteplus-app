import { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { PlatformModal } from '@/components/layout/platform/platformmodal';
import { PremiumButton } from '@/components/ui';
import { auroraGlass, useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { useDeviceClass } from '@/hooks/platform/useDeviceClass';
import { isDesktopClass } from '@/lib/platform/breakpoints';
import { spacing, typography } from '@/theme';

type FabAction = {
  key: string;
  label: string;
  onPress: () => void;
};

type EmployeePortalVisitFabMenuProps = {
  actions: FabAction[];
};

export function EmployeePortalVisitFabMenu({ actions }: EmployeePortalVisitFabMenuProps) {
  const text = useAuroraAdaptiveText();
  const deviceClass = useDeviceClass();
  const isMobile = !isDesktopClass(deviceClass);
  const [open, setOpen] = useState(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        fab: {
          position: 'absolute',
          right: spacing.md,
          bottom: 88,
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: '#8B5CF6',
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
        fabLabel: { color: '#fff', fontSize: 28, lineHeight: 30, fontWeight: '300' },
        menu: { gap: spacing.xs },
        menuItem: {
          borderWidth: 1,
          borderColor: auroraGlass.innerBorder,
          borderRadius: 10,
          padding: spacing.sm,
        },
        menuLabel: { ...typography.body, color: text.primary },
      }),
    [text],
  );

  return (
    <>
      <Pressable style={styles.fab} onPress={() => setOpen(true)} accessibilityRole="button">
        <Text style={styles.fabLabel}>+</Text>
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
