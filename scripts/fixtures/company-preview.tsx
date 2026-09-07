import React from 'react';
import { ThemeModeProvider } from '../../src/design/ThemeModeProvider';
import { WebFontScaleProvider } from '../../src/design/web/WebFontScaleProvider';
import { createRoot } from 'react-dom/client';
import { RegisterOrganizationScreen } from '../../src/liquid-command/screens/AccessScreens.web';
import { PlatformTenantsScreen } from '../../src/screens/platformConsole/PlatformTenantsScreen.web';
import { PlatformTenantDetailScreen } from '../../src/screens/platformConsole/PlatformTenantDetailScreen.web';
import { SupportWorkspace } from '../../src/components/support/SupportWorkspace';
import { PlatformShellLayout } from '../../src/components/platformConsole/PlatformShellLayout.web';
import { useRoute } from './company-preview-router';
import { CENTRAL_HEALTHOS_POPUP_CONTRACT_CSS } from '../../src/design/web/centralHealthOSPopupContractCss';
import { HEALTHOS_PAGE_CONTRACT_CSS } from '../../src/design/web/healthOSPageContractCss';
import { LLGAN_GLASS_SURFACE_CSS } from '../../src/design/web/lightLiquidGlassSurfaceCss';
const style = document.createElement('style');
style.textContent = LLGAN_GLASS_SURFACE_CSS + HEALTHOS_PAGE_CONTRACT_CSS + CENTRAL_HEALTHOS_POPUP_CONTRACT_CSS + 'html,body{height:100%;margin:0}body{display:flex;flex-direction:column}#preview{flex:1;min-height:0;display:flex}#preview>div{flex:1;min-width:0}#qa{padding:12px 16px;background:#071C38;color:white;font:14px/1.5 system-ui}#qa a{color:#86DEFF;margin-left:12px}.qa-note{padding:32px;background:#f6faff;color:#102f50;font:16px/1.6 system-ui}';
document.head.appendChild(style); document.documentElement.setAttribute('data-cs-central-popup', '');
function App() {
 const route = useRoute(); const path = route.split('?')[0];
 return <div data-cs-desktop-surface="light" style={{ display: 'flex', minHeight: 0 }}>
  {path === '/auth/register' ? <RegisterOrganizationScreen /> : path === '/platform/tenants' ? <PlatformTenantsScreen /> : path.startsWith('/platform/tenants/') ? <PlatformTenantDetailScreen /> : path === '/platform/support' ? <PlatformShellLayout title="Support-Zentrale" scroll={false}><SupportWorkspace platformMode initialSearch={new URLSearchParams(route.split('?')[1] ?? '').get('company') ?? ''} /></PlatformShellLayout> : <div className="qa-note"><h1>Lokale UI-Vorschau</h1><p>Dieser Bereich ist in der Vorschau nicht enthalten. Die Anmeldung, Rechtstexte und weitere Plattformbereiche werden hier nicht ausgeführt.</p><a href="#/platform/tenants">Unternehmensverwaltung öffnen</a> · <a href="#/auth/register">Zur Registrierung</a></div>}
 </div>;
}
createRoot(document.getElementById('preview')!).render(<ThemeModeProvider><WebFontScaleProvider><App /></WebFontScaleProvider></ThemeModeProvider>);
