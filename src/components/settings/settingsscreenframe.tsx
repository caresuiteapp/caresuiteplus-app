import { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { CareLightPageShell } from '@/components/layout';
import { PageHeader } from '@/components/layout/platform';
import { usePlatformLayout } from '@/hooks/usePlatformLayout';
import { spacing } from '@/theme';

type SettingsScreenFrameProps = {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  embeddedInModal?: boolean;
  showSideNavigation?: boolean;
  children: ReactNode;
};

export function SettingsScreenFrame({
  title,
  subtitle,
  showBack = true,
  embeddedInModal = false,
  showSideNavigation = false,
  children,
}: SettingsScreenFrameProps) {
  const { useMasterDetail } = usePlatformLayout();

  if (embeddedInModal) {
    return (
      <View style={styles.modalBody}>
        <PageHeader title={title} subtitle={subtitle} />
        <ScrollView contentContainerStyle={styles.scroll}>{children}</ScrollView>
      </View>
    );
  }

  return (
    <CareLightPageShell
      title={title}
      subtitle={subtitle}
      showBack={showBack}
      showBreadcrumbs={showSideNavigation || !useMasterDetail}
    >
      {children}
    </CareLightPageShell>
  );
}

const styles = StyleSheet.create({
  modalBody: { flex: 1, minHeight: 0 },
  scroll: { padding: spacing.md, gap: spacing.md },
});
