import 'react-native-reanimated';
import { PortalKeyboardProvider } from '@/components/keyboard/PortalKeyboard';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { AuthProvider } from '@/lib/auth/AuthProvider';
import { ThemeModeProvider } from '@/design/ThemeModeProvider';
import { WebFontScaleProvider } from '@/design/web/WebFontScaleProvider';
import { PerformanceProvider } from '@/lib/performance';
import { GlobalWorkflowFeedbackProvider } from '@/components/ui/GlobalWorkflowFeedback';
import { PortalWelcomeGate } from '@/components/auth/PortalWelcomeGate';
import { PortalBiometricGate } from '@/components/auth/PortalBiometricGate';
import { PortalOnlyRouteGuard } from '@/portal-app/PortalOnlyRouteGuard';
import { PortalPushRegistrationGate } from '@/components/portal/PortalPushRegistrationGate';
import { applyInvisibleScrollIndicators } from '@/design/scroll/applyInvisibleScrollIndicators';
import { installSystemTextDefaults } from '@/design/installSystemTextDefaults';
import '@/lib/employeeLogbook/employeeLogbookTracking';

applyInvisibleScrollIndicators();
installSystemTextDefaults();

const portalNavigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: 'transparent',
    card: 'transparent',
  },
};

function PortalOnlyRouter() {
  return (
    <ThemeProvider value={portalNavigationTheme}>
      <View style={styles.root}>
        <StatusBar style="dark" />
        <PortalBiometricGate>
          <PortalOnlyRouteGuard>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: styles.content,
                animation: 'fade',
              }}
            />
            <PortalWelcomeGate />
            <PortalPushRegistrationGate />
          </PortalOnlyRouteGuard>
        </PortalBiometricGate>
      </View>
    </ThemeProvider>
  );
}

export default function PortalOnlyRootLayout() {
  return (
    <AuthProvider>
      <ThemeModeProvider>
        <PerformanceProvider>
          <WebFontScaleProvider>
            <PortalKeyboardProvider>
            <GlobalWorkflowFeedbackProvider>
              <PortalOnlyRouter />
            </GlobalWorkflowFeedbackProvider>
            </PortalKeyboardProvider>
          </WebFontScaleProvider>
        </PerformanceProvider>
      </ThemeModeProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
  },
  content: {
    backgroundColor: 'transparent',
  },
});
