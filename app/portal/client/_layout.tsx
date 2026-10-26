import { ClientSignatureAttentionProvider } from '@/components/portal/ClientSignatureAttentionProvider';
import { useAuth } from '@/lib/auth/context';
import { RequireAuth, RequireRole } from '@/lib/auth';
import { LiquidPortalRouteLayout } from '@/liquid-command/shell/LiquidPortalRouteLayout';
import { ClientPortalAttentionPrompt } from '@/components/portal/ClientPortalAttentionPrompt';
import { useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isAcademyOnlyPortal } from '@/lib/akademie/portalAccess.shared';
import { ErrorState, LoadingState, PremiumButton } from '@/components/ui';
import { HealthOSPageSurface } from '@/components/layout/HealthOSPageSurface';
import { PortalPremiumProvider, portalPremium } from '@/design/tokens/portalPremium';
import { careSpacing } from '@/design/tokens/spacing';

/** Academy-only family access stays browser-only and never mounts care hooks. */
function FamilyBrowserAccess() {
  const auth = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const openBrowser = async () => {
    setError(null);
    try {
      await Linking.openURL('https://www.caresuiteplus.app/auth/portal-code-login');
    } catch {
      setError('Der Browser konnte nicht geöffnet werden. Öffnen Sie www.caresuiteplus.app/auth/portal-code-login und melden Sie sich mit Ihrem persönlichen Zugang an.');
    }
  };
  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    setError(null);
    try {
      await auth.signOut();
      router.replace('/auth/client-login' as never);
    } catch {
      setError('Abmelden ist gerade nicht möglich. Bitte versuchen Sie es erneut.');
    } finally {
      setSigningOut(false);
    }
  };
  return <PortalPremiumProvider kind="client"><ScrollView
    style={styles.browserViewport}
    contentContainerStyle={[styles.browserContent, { paddingTop: Math.max(insets.top, careSpacing.lg), paddingBottom: Math.max(insets.bottom, careSpacing.lg) }]}
    testID="family-browser-access"
  ><HealthOSPageSurface fill={false}><View style={styles.browserCopy}>
    <Text style={styles.eyebrow}>IHR PERSÖNLICHER ZUGANG</Text>
    <Text accessibilityRole="header" style={styles.title}>Ihr Lernbereich ist im Browser verfügbar</Text>
    <Text style={styles.message}>Melden Sie sich dort mit Ihrem persönlichen Akademiezugang an. Dieser Zugang öffnet keine Versorgungsdaten einer anderen Person.</Text>
    <PremiumButton title="Im Browser öffnen" onPress={() => void openBrowser()} fullWidth />
    <PremiumButton title="Abmelden" variant="secondary" loading={signingOut} onPress={() => void signOut()} fullWidth />
    {error ? <ErrorState title="Aktion nicht abgeschlossen" message={error} presentation="inline" /> : null}
  </View></HealthOSPageSurface></ScrollView></PortalPremiumProvider>;
}

export default function ClientPortalLiquidLayout() {
  const auth = useAuth();
  const { portalSession } = auth;
  if (!auth.authReady) return <LoadingState message="Sitzung wird geprüft…" />;
  if (isAcademyOnlyPortal(portalSession, auth.session, auth.user)) {
    return <RequireAuth redirectTo="/auth/client-login"><RequireRole><FamilyBrowserAccess /></RequireRole></RequireAuth>;
  }
  return (
    <ClientSignatureAttentionProvider key={`${portalSession?.tenantId}:${portalSession?.accountId}`}>
    <LiquidPortalRouteLayout
      kind="client"
      overlay={<ClientPortalAttentionPrompt />}
    />
    </ClientSignatureAttentionProvider>
  );
}

const styles = StyleSheet.create({
  browserViewport: { flex: 1, minHeight: 0, backgroundColor: '#F4F8FD' },
  browserContent: { flexGrow: 1, width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: careSpacing.md },
  browserCopy: { gap: careSpacing.md },
  eyebrow: { color: portalPremium.accent.blue, fontSize: 13, lineHeight: 18, fontWeight: '800' },
  title: { color: portalPremium.text.primary, fontSize: 25, lineHeight: 32, fontWeight: '800' },
  message: { color: portalPremium.text.secondary, fontSize: 17, lineHeight: 25 },
});
