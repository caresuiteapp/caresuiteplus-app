import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PlatformModal } from '@/components/layout/platform';
import { ModuleTile } from '@/components/ui';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { getModuleSwitcherItems } from '@/lib/navigation/shellConfig';
import { careSpacing } from '@/design/tokens/spacing';

type ModuleSwitcherProps = {
  visible: boolean;
  onClose: () => void;
};

export function ModuleSwitcher({ visible, onClose }: ModuleSwitcherProps) {
  const router = useRouter();
  const tenantId = useServiceTenantId();
  const modules = getModuleSwitcherItems(tenantId ?? '');

  const handleSelect = (path: string, isActive: boolean) => {
    if (!isActive) return;
    onClose();
    router.push(path as never);
  };

  return (
    <PlatformModal
      visible={visible}
      title="Modul wechseln"
      subtitle="Aktive CareSuite+ Module Ihres Mandanten"
      onClose={onClose}
      variant="center"
      animationType="fade"
      maxWidth={520}
      footerActions={[{ title: 'Schließen', onPress: onClose, variant: 'secondary' }]}
    >
      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {modules.map((mod) => (
          <ModuleTile
            key={mod.productKey}
            icon={mod.icon}
            title={mod.label}
            description={mod.description}
            accentColor={mod.accentColor}
            isActive={mod.isActive}
            onPress={() => handleSelect(mod.path, mod.isActive)}
          />
        ))}
      </ScrollView>
    </PlatformModal>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: careSpacing.sm,
    paddingBottom: careSpacing.sm,
  },
});
