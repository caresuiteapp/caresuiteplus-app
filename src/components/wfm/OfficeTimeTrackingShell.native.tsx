// Generated native presentation from src/components/wfm/OfficeTimeTrackingShell.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeSvgCircle,NativeSvgPath} from '@/components/layout/NativeSvgPresentation.native';
import {NativeA,NativeSection,NativeStyle,NativeHeader,NativeDiv,NativeSpan,NativeP,NativeH1,NativeNav,NativeH2,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import { WebActionIcon } from "../icons/WebActionIcon.native.tsx";
import { useEffect, useRef, type MouseEvent, type ReactNode } from 'react';
import { Slot, useIsFocused, usePathname, useRouter } from 'expo-router';
import { SurfaceContrastProvider } from '@/design/tokens/surfaceContrast';
import { useAuth } from '@/lib/auth/context';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { isPortalOnlyRole } from '@/lib/permissions/workspaceRoles';
import { isOfficeTimeTrackingOwnCaptureRoute, OFFICE_TIME_TRACKING_OWN_HREF, OFFICE_TIME_TRACKING_TABS, resolveOfficeTimeTrackingTabKey, } from '@/lib/navigation/officeTimeTrackingNav';
import { officeTimeTrackingShellCss } from "./officeTimeTrackingShellCss.native.ts";
function Clock() {
    return <NativeWorkspaceStyleScope css={[officeTimeTrackingShellCss]}>{<WebActionIcon size={24}><NativeSvgCircle cx="12" cy="12" r="9"/><NativeSvgPath d="M12 6v6l4 2"/></WebActionIcon>}</NativeWorkspaceStyleScope>;
}
export function OfficeTimeTrackingShell() {
    const auth = useAuth();
    const { roleKey, permissions } = usePermissions();
    const tenantId = useServiceTenantId();
    const pathname = usePathname();
    const router = useRouter();
    const focused = useIsFocused();
    const scrollRef = useRef<HTMLDivElement>(null);
    const currentTab = useRef<HTMLAnchorElement>(null);
    const ownCapture = isOfficeTimeTrackingOwnCaptureRoute(pathname);
    const activeTab = ownCapture ? null : resolveOfficeTimeTrackingTabKey(pathname);
    const scopeKey = JSON.stringify([tenantId, auth.user?.id, roleKey, [...permissions].sort()]);
    const allowed = Boolean(auth.authReady && auth.isAuthenticated && auth.user?.id && tenantId && roleKey && !auth.portalSession && !isPortalOnlyRole(roleKey));
    useEffect(() => {
        if (!focused)
            return;
        scrollRef.current?.scrollTo?.({ top: 0, behavior: 'auto' });
        currentTab.current?.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
    }, [pathname, focused]);
    function navigate(event: MouseEvent<HTMLAnchorElement>, href: string) {
        // Preserve normal open-in-new-tab/link-copy behavior.
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
            return;
        event.preventDefault();
        if (focused && href !== pathname)
            router.push(href as never);
    }
    function link(href: string, children: ReactNode, selected = false) {
        return <NativeWorkspaceStyleScope css={[officeTimeTrackingShellCss]}>{<NativeA href={href} className="otw-action" aria-current={selected ? 'page' : undefined} onClick={event => navigate(event, href)}>{children}</NativeA>}</NativeWorkspaceStyleScope>;
    }
    return <NativeWorkspaceStyleScope css={[officeTimeTrackingShellCss, officeTimeTrackingShellCss]}>{<NativeSection className="otw-shell" data-cs-wfm-surface="light" data-cs-personal-surface="light" data-worktime-workspace="2026-10" aria-label="Arbeitszeit">
    <NativeStyle>{officeTimeTrackingShellCss}</NativeStyle>
    <NativeHeader className="otw-header">
      <NativeDiv className="otw-title"><NativeSpan className="otw-symbol"><Clock /></NativeSpan><NativeDiv><NativeP>Office</NativeP><NativeH1>Arbeitszeit</NativeH1></NativeDiv></NativeDiv>
      <NativeDiv className="otw-actions">
        {link('/business/office/payroll', <><NativeSpan aria-hidden="true">€</NativeSpan> Gehaltsstatistik</>)}
        {link(OFFICE_TIME_TRACKING_OWN_HREF, <><NativeSpan aria-hidden="true">＋</NativeSpan> Eigene Erfassung</>, ownCapture)}
      </NativeDiv>
    </NativeHeader>
    <NativeNav className="otw-nav" aria-label="Arbeitszeit-Bereiche">
      {OFFICE_TIME_TRACKING_TABS.map(tab => <NativeA key={tab.key} href={tab.href} ref={activeTab === tab.key ? currentTab : undefined} aria-current={activeTab === tab.key ? 'page' : undefined} data-testid={`office-time-tab-${tab.key}`} onClick={event => navigate(event, tab.href)}>{tab.key === 'live' ? <NativeSpan className="otw-live-dot" aria-hidden="true"/> : null}{tab.label}</NativeA>)}
    </NativeNav>
    <NativeDiv ref={scrollRef} className="otw-scroll" data-testid="office-time-workspace-scroll" tabIndex={0} aria-label="Arbeitszeit-Inhalt">
      {!auth.authReady ? <NativeDiv className="otw-state" role="status">Zugang wird geprüft …</NativeDiv>
            : !allowed ? <NativeDiv className="otw-state" role="status"><NativeH2>Verwaltungszugang erforderlich</NativeH2><NativeP>Melden Sie sich mit einem freigegebenen Verwaltungszugang an, um Arbeitszeiten zu verwalten.</NativeP></NativeDiv>
                : <NativeDiv className="otw-content" key={scopeKey}><SurfaceContrastProvider tone="light"><Slot /></SurfaceContrastProvider></NativeDiv>}
    </NativeDiv>
  </NativeSection>}</NativeWorkspaceStyleScope>;
}
