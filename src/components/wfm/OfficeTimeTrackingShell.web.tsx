import { WebActionIcon } from '@/components/icons/WebActionIcon.web';
import { useEffect, useRef, type MouseEvent, type ReactNode } from 'react';
import { Slot, useIsFocused, usePathname, useRouter } from 'expo-router';
import { SurfaceContrastProvider } from '@/design/tokens/surfaceContrast';
import { useAuth } from '@/lib/auth/context';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { isPortalOnlyRole } from '@/lib/permissions/workspaceRoles';
import {
  isOfficeTimeTrackingOwnCaptureRoute,
  OFFICE_TIME_TRACKING_OWN_HREF,
  OFFICE_TIME_TRACKING_TABS,
  resolveOfficeTimeTrackingTabKey,
} from '@/lib/navigation/officeTimeTrackingNav';
import { officeTimeTrackingShellCss } from './officeTimeTrackingShellCss.web';

function Clock() {
  return <WebActionIcon size={24}><circle cx="12" cy="12" r="9" /><path d="M12 6v6l4 2" /></WebActionIcon>;
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
    if (!focused) return;
    scrollRef.current?.scrollTo?.({ top: 0, behavior: 'auto' });
    currentTab.current?.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
  }, [pathname, focused]);

  function navigate(event: MouseEvent<HTMLAnchorElement>, href: string) {
    // Preserve normal open-in-new-tab/link-copy behavior.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (focused && href !== pathname) router.push(href as never);
  }
  function link(href: string, children: ReactNode, selected = false) {
    return <a href={href} className="otw-action" aria-current={selected ? 'page' : undefined} onClick={event => navigate(event, href)}>{children}</a>;
  }

  return <section className="otw-shell" data-cs-wfm-surface="light" data-cs-personal-surface="light" data-worktime-workspace="2026-10" aria-label="Arbeitszeit">
    <style>{officeTimeTrackingShellCss}</style>
    <header className="otw-header">
      <div className="otw-title"><span className="otw-symbol"><Clock /></span><div><p>Office</p><h1>Arbeitszeit</h1></div></div>
      <div className="otw-actions">
        {link('/business/office/payroll', <><span aria-hidden="true">€</span> Gehaltsstatistik</>)}
        {link(OFFICE_TIME_TRACKING_OWN_HREF, <><span aria-hidden="true">＋</span> Eigene Erfassung</>, ownCapture)}
      </div>
    </header>
    <nav className="otw-nav" aria-label="Arbeitszeit-Bereiche">
      {OFFICE_TIME_TRACKING_TABS.map(tab => <a key={tab.key} href={tab.href} ref={activeTab === tab.key ? currentTab : undefined} aria-current={activeTab === tab.key ? 'page' : undefined} data-testid={`office-time-tab-${tab.key}`} onClick={event => navigate(event, tab.href)}>{tab.key === 'live' ? <span className="otw-live-dot" aria-hidden="true" /> : null}{tab.label}</a>)}
    </nav>
    <div ref={scrollRef} className="otw-scroll" data-testid="office-time-workspace-scroll" tabIndex={0} aria-label="Arbeitszeit-Inhalt">
      {!auth.authReady ? <div className="otw-state" role="status">Zugang wird geprüft …</div>
        : !allowed ? <div className="otw-state" role="status"><h2>Verwaltungszugang erforderlich</h2><p>Melden Sie sich mit einem freigegebenen Verwaltungszugang an, um Arbeitszeiten zu verwalten.</p></div>
          : <div className="otw-content" key={scopeKey}><SurfaceContrastProvider tone="light"><Slot /></SurfaceContrastProvider></div>}
    </div>
  </section>;
}
