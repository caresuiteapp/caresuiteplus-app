import { WebActionIcon } from '@/components/icons/WebActionIcon.web';
import type { ReactNode } from 'react';
import { useAuth } from '@/lib/auth/context';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { fetchCatalogWorkspace } from '@/lib/catalog/catalogWorkspace.web';
import { catalogWorkspaceCss } from './catalogWorkspaceCss.web';

export function useCatalogWorkspaceData() {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const access = usePermissions();
  const allowed = Boolean(tenantId && access.can('office.catalogs.view') && access.hasModuleGate('office'));
  const scope = JSON.stringify([tenantId, profile?.id, profile?.tenantId, profile?.roleKey, [...access.permissions].sort()]);
  const query = useAsyncQuery(
    () => fetchCatalogWorkspace(tenantId ?? '', profile, access.permissions),
    [scope],
    { enabled: allowed, queryKey: scope },
  );
  return {
    ...access, tenantId, scope, allowed,
    snapshot: allowed ? query.data : null,
    loading: query.loading || query.refreshing,
    error: query.error ?? query.refreshError,
    refresh: query.refresh,
    canEdit: allowed && Boolean(query.data?.canEdit) && access.can('business.tenant.manage'),
  };
}

type IconName = 'book' | 'plus' | 'search' | 'refresh' | 'arrow' | 'back' | 'grid' | 'list' | 'edit' | 'check' | 'alert' | 'layers';
export function CatalogIcon({ kind = 'book' }: { kind?: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    book: <><path d="M4 4h7a3 3 0 0 1 3 3v14a4 4 0 0 0-4-2H4z"/><path d="M14 7a3 3 0 0 1 3-3h3v15h-2a4 4 0 0 0-4 2M7 8h3M7 12h3"/></>,
    plus: <path d="M12 5v14M5 12h14"/>,
    search: <><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></>,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 7a7 7 0 0 1 12-1l2 3M4 15l2 3a7 7 0 0 0 12-1"/></>,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6"/>,
    back: <path d="M19 12H5m6-6-6 6 6 6"/>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    list: <><path d="M9 5h12M9 12h12M9 19h12"/><path d="M3 5h1M3 12h1M3 19h1"/></>,
    edit: <><path d="m14 5 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14z"/></>,
    check: <><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></>,
    alert: <><path d="m12 3 10 18H2zM12 9v5M12 17h.01"/></>,
    layers: <><path d="m12 3 10 5-10 5L2 8zM3 12l9 5 9-5M3 16l9 5 9-5"/></>,
  };
  return <WebActionIcon>{paths[kind]}</WebActionIcon>;
}

export function CatalogWorkspace({ title, subtitle, children, actions, back, busy = false }: {
  title: string; subtitle: string; children: ReactNode; actions?: ReactNode; back?: () => void; busy?: boolean;
}) {
  return <section className="cw" aria-label={title}>
    <style>{catalogWorkspaceCss}</style>
    <div className="cw-scroll">
      <header className="cw-header">
        <div className="cw-title-group">
          {back ? <button className="cw-icon-button" type="button" aria-label="Zurück zu Kataloge" onClick={back}><CatalogIcon kind="back"/></button> : null}
          <div className="cw-mark"><CatalogIcon/></div>
          <div className="cw-title"><p className="cw-eyebrow">OFFICE · KATALOGE</p><h1>{title}</h1><p className="cw-subtitle">{subtitle}</p></div>
        </div>
        <div className="cw-actions">{actions}</div>
      </header>
      <div className="cw-content" aria-busy={busy}>{children}</div>
    </div>
  </section>;
}

export function CatalogRefresh({ loading, onRefresh }: { loading: boolean; onRefresh: () => void }) {
  return <button className="cw-button" type="button" disabled={loading} onClick={onRefresh}><span className={loading ? 'cw-spinning' : undefined}><CatalogIcon kind="refresh"/></span>{loading ? 'Lädt…' : 'Aktualisieren'}</button>;
}

export function CatalogState({ title, message, kind = 'empty', action }: {
  title: string; message: string; kind?: 'empty' | 'error' | 'loading' | 'locked'; action?: ReactNode;
}) {
  return <div className={`cw-state cw-state--${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
    <div className="cw-state-icon"><CatalogIcon kind={kind === 'error' || kind === 'locked' ? 'alert' : kind === 'loading' ? 'refresh' : 'book'}/></div>
    <h2>{title}</h2><p>{message}</p>{action ? <div className="cw-actions">{action}</div> : null}
  </div>;
}

export function CatalogNotice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return <div className={`cw-notice${error ? ' cw-notice--error' : ''}`} role={error ? 'alert' : 'status'}><CatalogIcon kind={error ? 'alert' : 'check'}/><div>{children}</div></div>;
}

export function CatalogStats({ items }: { items: { label: string; value: number; detail: string; icon: IconName; tone?: 'teal' | 'amber' | 'slate' }[] }) {
  return <div className="cw-stats">{items.map(item => <div className={`cw-stat cw-stat--${item.tone ?? 'blue'}`} key={item.label}>
    <span className="cw-stat-icon"><CatalogIcon kind={item.icon}/></span><div><span className="cw-stat-label">{item.label}</span><strong>{item.value}</strong><span className="cw-stat-detail">{item.detail}</span></div>
  </div>)}</div>;
}

export function CatalogViewToggle({ value, onChange }: { value: 'cards' | 'table'; onChange: (value: 'cards' | 'table') => void }) {
  return <div className="cw-view-toggle" role="group" aria-label="Ansicht auswählen">
    <button type="button" aria-label="Kartenansicht" aria-pressed={value === 'cards'} onClick={() => onChange('cards')}><CatalogIcon kind="grid"/><span>Karten</span></button>
    <button type="button" aria-label="Tabellenansicht" aria-pressed={value === 'table'} onClick={() => onChange('table')}><CatalogIcon kind="list"/><span>Tabelle</span></button>
  </div>;
}

export function CatalogStatus({ active }: { active: boolean }) {
  return <span className={`cw-badge${active ? ' cw-badge--active' : ' cw-badge--inactive'}`}><span/>{active ? 'Aktiv' : 'Inaktiv'}</span>;
}
