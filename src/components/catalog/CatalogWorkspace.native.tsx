// Generated native presentation from src/components/catalog/CatalogWorkspace.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeSvgPath,NativeSvgCircle,NativeSvgRect} from '@/components/layout/NativeSvgPresentation.native';
import {NativeSection,NativeStyle,NativeDiv,NativeHeader,NativeButton,NativeP,NativeH1,NativeSpan,NativeH2,NativeStrong,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import { WebActionIcon } from "../icons/WebActionIcon.native.tsx";
import type { ReactNode } from 'react';
import { useAuth } from '@/lib/auth/context';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { fetchCatalogWorkspace } from "../../lib/catalog/catalogWorkspace.native.ts";
import { catalogWorkspaceCss } from "./catalogWorkspaceCss.native.ts";
export function useCatalogWorkspaceData() {
    const { profile } = useAuth();
    const tenantId = useServiceTenantId();
    const access = usePermissions();
    const allowed = Boolean(tenantId && access.can('office.catalogs.view') && access.hasModuleGate('office'));
    const scope = JSON.stringify([tenantId, profile?.id, profile?.tenantId, profile?.roleKey, [...access.permissions].sort()]);
    const query = useAsyncQuery(() => fetchCatalogWorkspace(tenantId ?? '', profile, access.permissions), [scope], { enabled: allowed, queryKey: scope });
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
export function CatalogIcon({ kind = 'book' }: {
    kind?: IconName;
}) {
    const paths: Record<IconName, ReactNode> = {
        book: <><NativeSvgPath d="M4 4h7a3 3 0 0 1 3 3v14a4 4 0 0 0-4-2H4z"/><NativeSvgPath d="M14 7a3 3 0 0 1 3-3h3v15h-2a4 4 0 0 0-4 2M7 8h3M7 12h3"/></>,
        plus: <NativeSvgPath d="M12 5v14M5 12h14"/>,
        search: <><NativeSvgCircle cx="10" cy="10" r="6"/><NativeSvgPath d="m15 15 5 5"/></>,
        refresh: <><NativeSvgPath d="M20 7v5h-5M4 17v-5h5"/><NativeSvgPath d="M6 7a7 7 0 0 1 12-1l2 3M4 15l2 3a7 7 0 0 0 12-1"/></>,
        arrow: <NativeSvgPath d="M5 12h14m-6-6 6 6-6 6"/>,
        back: <NativeSvgPath d="M19 12H5m6-6-6 6 6 6"/>,
        grid: <><NativeSvgRect x="3" y="3" width="7" height="7" rx="1"/><NativeSvgRect x="14" y="3" width="7" height="7" rx="1"/><NativeSvgRect x="3" y="14" width="7" height="7" rx="1"/><NativeSvgRect x="14" y="14" width="7" height="7" rx="1"/></>,
        list: <><NativeSvgPath d="M9 5h12M9 12h12M9 19h12"/><NativeSvgPath d="M3 5h1M3 12h1M3 19h1"/></>,
        edit: <><NativeSvgPath d="m14 5 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14z"/></>,
        check: <><NativeSvgCircle cx="12" cy="12" r="9"/><NativeSvgPath d="m8 12 3 3 5-6"/></>,
        alert: <><NativeSvgPath d="m12 3 10 18H2zM12 9v5M12 17h.01"/></>,
        layers: <><NativeSvgPath d="m12 3 10 5-10 5L2 8zM3 12l9 5 9-5M3 16l9 5 9-5"/></>,
    };
    return <NativeWorkspaceStyleScope css={[catalogWorkspaceCss]}>{<WebActionIcon>{paths[kind]}</WebActionIcon>}</NativeWorkspaceStyleScope>;
}
export function CatalogWorkspace({ title, subtitle, children, actions, back, busy = false }: {
    title: string;
    subtitle: string;
    children: ReactNode;
    actions?: ReactNode;
    back?: () => void;
    busy?: boolean;
}) {
    return <NativeWorkspaceStyleScope css={[catalogWorkspaceCss, catalogWorkspaceCss]}>{<NativeSection className="cw" aria-label={title}>
    <NativeStyle>{catalogWorkspaceCss}</NativeStyle>
    <NativeDiv className="cw-scroll">
      <NativeHeader className="cw-header">
        <NativeDiv className="cw-title-group">
          {back ? <NativeButton className="cw-icon-button" type="button" aria-label="Zurück zu Kataloge" onClick={back}><CatalogIcon kind="back"/></NativeButton> : null}
          <NativeDiv className="cw-mark"><CatalogIcon /></NativeDiv>
          <NativeDiv className="cw-title"><NativeP className="cw-eyebrow">OFFICE · KATALOGE</NativeP><NativeH1>{title}</NativeH1><NativeP className="cw-subtitle">{subtitle}</NativeP></NativeDiv>
        </NativeDiv>
        <NativeDiv className="cw-actions">{actions}</NativeDiv>
      </NativeHeader>
      <NativeDiv className="cw-content" aria-busy={busy}>{children}</NativeDiv>
    </NativeDiv>
  </NativeSection>}</NativeWorkspaceStyleScope>;
}
export function CatalogRefresh({ loading, onRefresh }: {
    loading: boolean;
    onRefresh: () => void;
}) {
    return <NativeWorkspaceStyleScope css={[catalogWorkspaceCss]}>{<NativeButton className="cw-button" type="button" disabled={loading} onClick={onRefresh}><NativeSpan className={loading ? 'cw-spinning' : undefined}><CatalogIcon kind="refresh"/></NativeSpan>{loading ? 'Lädt…' : 'Aktualisieren'}</NativeButton>}</NativeWorkspaceStyleScope>;
}
export function CatalogState({ title, message, kind = 'empty', action }: {
    title: string;
    message: string;
    kind?: 'empty' | 'error' | 'loading' | 'locked';
    action?: ReactNode;
}) {
    return <NativeWorkspaceStyleScope css={[catalogWorkspaceCss]}>{<NativeDiv className={`cw-state cw-state--${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
    <NativeDiv className="cw-state-icon"><CatalogIcon kind={kind === 'error' || kind === 'locked' ? 'alert' : kind === 'loading' ? 'refresh' : 'book'}/></NativeDiv>
    <NativeH2>{title}</NativeH2><NativeP>{message}</NativeP>{action ? <NativeDiv className="cw-actions">{action}</NativeDiv> : null}
  </NativeDiv>}</NativeWorkspaceStyleScope>;
}
export function CatalogNotice({ children, error = false }: {
    children: ReactNode;
    error?: boolean;
}) {
    return <NativeWorkspaceStyleScope css={[catalogWorkspaceCss]}>{<NativeDiv className={`cw-notice${error ? ' cw-notice--error' : ''}`} role={error ? 'alert' : 'status'}><CatalogIcon kind={error ? 'alert' : 'check'}/><NativeDiv>{children}</NativeDiv></NativeDiv>}</NativeWorkspaceStyleScope>;
}
export function CatalogStats({ items }: {
    items: {
        label: string;
        value: number;
        detail: string;
        icon: IconName;
        tone?: 'teal' | 'amber' | 'slate';
    }[];
}) {
    return <NativeWorkspaceStyleScope css={[catalogWorkspaceCss]}>{<NativeDiv className="cw-stats">{items.map(item => <NativeDiv className={`cw-stat cw-stat--${item.tone ?? 'blue'}`} key={item.label}>
    <NativeSpan className="cw-stat-icon"><CatalogIcon kind={item.icon}/></NativeSpan><NativeDiv><NativeSpan className="cw-stat-label">{item.label}</NativeSpan><NativeStrong>{item.value}</NativeStrong><NativeSpan className="cw-stat-detail">{item.detail}</NativeSpan></NativeDiv>
  </NativeDiv>)}</NativeDiv>}</NativeWorkspaceStyleScope>;
}
export function CatalogViewToggle({ value, onChange }: {
    value: 'cards' | 'table';
    onChange: (value: 'cards' | 'table') => void;
}) {
    return <NativeWorkspaceStyleScope css={[catalogWorkspaceCss]}>{<NativeDiv className="cw-view-toggle" role="group" aria-label="Ansicht auswählen">
    <NativeButton type="button" aria-label="Kartenansicht" aria-pressed={value === 'cards'} onClick={() => onChange('cards')}><CatalogIcon kind="grid"/><NativeSpan>Karten</NativeSpan></NativeButton>
    <NativeButton type="button" aria-label="Tabellenansicht" aria-pressed={value === 'table'} onClick={() => onChange('table')}><CatalogIcon kind="list"/><NativeSpan>Tabelle</NativeSpan></NativeButton>
  </NativeDiv>}</NativeWorkspaceStyleScope>;
}
export function CatalogStatus({ active }: {
    active: boolean;
}) {
    return <NativeWorkspaceStyleScope css={[catalogWorkspaceCss]}>{<NativeSpan className={`cw-badge${active ? ' cw-badge--active' : ' cw-badge--inactive'}`}><NativeSpan />{active ? 'Aktiv' : 'Inaktiv'}</NativeSpan>}</NativeWorkspaceStyleScope>;
}
