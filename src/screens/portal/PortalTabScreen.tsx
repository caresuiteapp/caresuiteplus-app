import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenShell } from '@/components/layout';
import { PremiumButton } from '@/components/ui';
import { useAuth } from '@/lib/auth/context';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { usePlatformLayout } from '@/hooks/usePlatformLayout';
import { PORTAL_MOBILE_NAV_HEIGHT } from '@/lib/navigation/portalMobileTabs';

type PortalTabScreenProps = {
  title: string;
  children: ReactNode;
  scroll?: boolean;
  /** On phone: skip duplicate page header — hero or section title carries context. */
  hideHeaderOnPhone?: boolean;
};

export function PortalTabScreen({
  title,
  children,
  scroll = true,
  hideHeaderOnPhone = false,
}: PortalTabScreenProps) {
  const router = useRouter();
  const { signOut } = useAuth();
  const { isPhone } = useDeviceClass();
  const { showBottomTabs } = usePlatformLayout();
  const signOutButton = (
    <PremiumButton
      title="Abmelden"
      variant="ghost"
      size="sm"
      onPress={() => signOut().then(() => router.replace('/' as never))}
    />
  );

  if (isPhone && hideHeaderOnPhone) {
    return (
      <SafeAreaView style={styles.bare} edges={[]}>
        <View
          style={[
            styles.bareContent,
            showBottomTabs && { paddingBottom: PORTAL_MOBILE_NAV_HEIGHT },
          ]}
        >
          {children}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <ScreenShell
      title={title}
      subtitle={isPhone ? undefined : 'Ihr persönlicher Portalbereich'}
      showBack={false}
      scroll={scroll}
      rightSlot={signOutButton}
    >
      <View style={styles.content}>{children}</View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  bare: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  bareToolbar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
    paddingBottom: 4,
  },
  bareContent: {
    flex: 1,
  },
});
