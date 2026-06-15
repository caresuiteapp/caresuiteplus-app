import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ModuleTile } from '@/components/ui';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { getModuleSwitcherItems } from '@/lib/navigation/shellConfig';
import { colors, radius, spacing, typography } from '@/theme';

type ModuleSwitcherProps = {
  visible: boolean;
  onClose: () => void;
};

export function ModuleSwitcher({ visible, onClose }: ModuleSwitcherProps) {
  const router = useRouter();
  const tenantId = useServiceTenantId();
  const { profile } = useAuth();
  const modules = getModuleSwitcherItems(tenantId ?? '', profile?.roleKey ?? null);

  const handleSelect = (path: string, isNavigable: boolean) => {
    if (!isNavigable) return;
    onClose();
    router.push(path as never);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <Text style={styles.title}>Modul wechseln</Text>
          <Text style={styles.subtitle}>Freigegebene CareSuite+ Module Ihres Mandanten</Text>
          <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
            {modules.map((mod) => (
              <ModuleTile
                key={mod.productKey}
                icon={mod.icon}
                title={mod.label}
                description={mod.description}
                accentColor={mod.accentColor}
                isActive={mod.isNavigable}
                visibilityStatus={mod.visibilityStatus}
                badgeLabel={mod.badgeLabel}
                isNavigable={mod.isNavigable}
                onPress={
                  mod.isNavigable ? () => handleSelect(mod.path, mod.isNavigable) : undefined
                }
              />
            ))}
          </ScrollView>
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeText}>Schließen</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.bgPremium,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.md,
    maxHeight: '78%',
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderSoft,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  title: { ...typography.h3, marginBottom: 4 },
  subtitle: { ...typography.caption, marginBottom: spacing.md },
  list: { gap: spacing.sm, paddingBottom: spacing.md },
  closeBtn: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  closeText: {
    ...typography.bodyStrong,
    color: colors.cyan,
  },
});
