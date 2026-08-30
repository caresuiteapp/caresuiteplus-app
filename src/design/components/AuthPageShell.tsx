import { ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppScreen } from './AppScreen';
import { AuthScreenHeader } from './AuthHero';
import { SpatialCareScene } from './SpatialCareScene';
import { spatialCare } from '@/design/tokens/spatialCareSuite';
import { portalPremium, PortalPremiumProvider } from '@/design/tokens/portalPremium';
import { useDeviceClass } from '@/hooks/useDeviceClass';

type AuthPageShellProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  scroll?: boolean;
  showBack?: boolean;
  onBack?: () => void;
  keyboardAvoiding?: boolean;
};

/** Auth flow wrapper — space background, safe area, keyboard avoiding on forms. */
export function AuthPageShell({
  title,
  subtitle,
  children,
  scroll = true,
  showBack = true,
  onBack,
  keyboardAvoiding = false,
}: AuthPageShellProps) {
  const router = useRouter();
  const { isPhone, isTablet } = useDeviceClass();
  const handleBack = onBack ?? (() => router.back());

  return (
    <PortalPremiumProvider kind="workspace">
      <AppScreen
        appearance="light"
        scroll={scroll}
        keyboardAvoiding={keyboardAvoiding}
        maxWidth={1180}
        contentStyle={styles.screen}
      >
        <View style={[styles.layout, (isPhone || isTablet) && styles.layoutCompact]}>
          {!isPhone ? <View style={[styles.visual, isTablet && styles.visualCompact]}><SpatialCareScene /></View> : null}
          <View style={[styles.formPanel, (isPhone || isTablet) && styles.formPanelCompact]}>
            <AuthScreenHeader
              title={title}
              subtitle={subtitle}
              showBack={showBack}
              onBack={handleBack}
            />
            {children}
          </View>
        </View>
      </AppScreen>
    </PortalPremiumProvider>
  );
}

const styles = StyleSheet.create({
  screen: { justifyContent: 'center' },
  layout: { width: '100%', flexDirection: 'row', gap: 18, alignItems: 'stretch' },
  layoutCompact: { flexDirection: 'column' },
  visual: { flex: 1.05, minWidth: 0, ...(Platform.OS === 'web' ? ({ minHeight: 560 } as const) : null) },
  visualCompact: { flex: 0, minHeight: 300 },
  formPanel: {
    flex: 0.95,
    minWidth: 320,
    padding: 28,
    borderRadius: spatialCare.radius.stage,
    backgroundColor: portalPremium.surfaceRaised,
    borderWidth: 1,
    borderColor: portalPremium.borderStrong,
    gap: 14,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: portalPremium.shadow.panel, backdropFilter: 'blur(24px)' } as const)
      : ({
          shadowColor: '#12355B',
          shadowOffset: { width: 0, height: 14 },
          shadowOpacity: 0.14,
          shadowRadius: 24,
          elevation: 8,
        } as const)),
  },
  formPanelCompact: { flex: 0, minWidth: 0, padding: 20, borderRadius: 24 },
});
