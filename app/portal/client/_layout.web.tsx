import { Redirect, Stack, usePathname } from 'expo-router';
import { useAuth, RequireAuth, RequireRole } from '@/lib/auth';
import { LoadingState } from '@/components/ui';
import { ClientSignatureAttentionProvider } from '@/components/portal/ClientSignatureAttentionProvider';
import { ClientPortalAttentionPrompt } from '@/components/portal/ClientPortalAttentionPrompt';
import { LiquidPortalRouteLayout } from '@/liquid-command/shell/LiquidPortalRouteLayout';
import { LiquidBackdrop, LiquidVisualModeProvider } from '@/liquid-command/components/LiquidPrimitives';
import { PortalPremiumProvider } from '@/design/tokens/portalPremium';
import { PortalTextSizeControls } from '@/components/portal/accessibility/PortalTextSizeControls';
import { isAcademyOnlyPortal } from '@/lib/akademie/portalAccess.web';
import { careSuiteAuroraTheme } from '@/theme/careSuiteAurora';
import { systemLiquidGlass } from '@/design/tokens/systemLiquidGlass';

/** Family learning accounts never mount client-care hooks, signatures or messaging. */
function FamilyAcademyPortal() {
  const path = usePathname();
  const { signOut } = useAuth();
  if (path.replace(/\/$/, '') !== '/portal/client/akademie') return <Redirect href={'/portal/client/akademie' as never} />;
  return <PortalPremiumProvider kind="client"><LiquidVisualModeProvider mode="orbit"><LiquidBackdrop>
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, padding: '16px 20px', background: careSuiteAuroraTheme.glass.backgroundStrong, borderBottom: `1px solid ${careSuiteAuroraTheme.glass.border}` }}>
        <div style={{ color: systemLiquidGlass.text.primary }}><div style={{ fontWeight: 800, fontSize: 18 }}>CareSuite+ Akademie</div><div style={{ fontSize: 13, marginTop: 3 }}>Mein persönlicher Lernbereich</div></div>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}><PortalTextSizeControls compact />
          <button type="button" onClick={() => void signOut()} style={{ padding: '10px 14px', border: `1px solid ${careSuiteAuroraTheme.glass.borderStrong}`, borderRadius: 12, background: systemLiquidGlass.rowSelected, color: systemLiquidGlass.text.primary, fontWeight: 700, cursor: 'pointer' }}>Abmelden</button>
        </div>
      </header>
      <Stack screenOptions={{ headerShown: false, animation: 'none', contentStyle: { backgroundColor: 'transparent' } }} />
    </div>
  </LiquidBackdrop></LiquidVisualModeProvider></PortalPremiumProvider>;
}

export default function ClientPortalWebLayout() {
  const auth = useAuth();
  if (!auth.authReady) return <LoadingState message="Sitzung wird geprüft…" />;
  if (isAcademyOnlyPortal(auth.portalSession, auth.session, auth.user)) {
    return <RequireAuth redirectTo="/auth/client-login"><RequireRole><FamilyAcademyPortal /></RequireRole></RequireAuth>;
  }
  return <ClientSignatureAttentionProvider key={`${auth.portalSession?.tenantId}:${auth.portalSession?.accountId}`}>
    <LiquidPortalRouteLayout kind="client" overlay={<ClientPortalAttentionPrompt />} />
  </ClientSignatureAttentionProvider>;
}
