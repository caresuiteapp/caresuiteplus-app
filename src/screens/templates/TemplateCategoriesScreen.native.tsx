// Generated native presentation from src/screens/templates/TemplateCategoriesScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeDiv,NativeLabel,NativeInput,NativeButton,NativeTable,NativeThead,NativeTr,NativeTh,NativeTbody,NativeTd} from '@/components/layout/NativeWorkspaceElements.native';
import { useState } from 'react';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { fetchTemplateCategories } from '@/lib/templates/templateCategoriesService';
import { TEMPLATE_MODULE_LABELS, TemplateAccessMessage, TemplateWorkspaceFrame } from "../../components/templates/TemplateWorkspace.native.tsx";
import type { TemplateModuleKey } from '@/types/templates';
export function TemplateCategoriesScreen() {
    const tenantId = useServiceTenantId();
    const { profile } = useAuth();
    const { can } = usePermissions();
    const [search, setSearch] = useState('');
    const query = useAsyncQuery(() => fetchTemplateCategories(tenantId!, profile?.roleKey), [tenantId, profile?.roleKey], { enabled: !!tenantId && can('office.catalogs.view'), queryKey: JSON.stringify([tenantId, profile?.roleKey]) });
    const rows = (query.data ?? []).filter(row => `${row.label} ${TEMPLATE_MODULE_LABELS[row.moduleKey as TemplateModuleKey] ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()));
    return <TemplateWorkspaceFrame title="Vorlagenkategorien" description="Die gespeicherte Zuordnung Ihrer Textvorlagen zu den Arbeitsbereichen.">{!can('office.catalogs.view') ? <TemplateAccessMessage /> : !tenantId ? <NativeDiv className="dw-alert">Bitte zuerst ein Unternehmen auswählen.</NativeDiv> : <><NativeLabel className="dw-field">Suche<NativeInput className="dw-input" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Kategorie suchen"/></NativeLabel>{query.error || query.refreshError ? <NativeDiv className="dw-alert" data-tone="danger" role="alert">{query.error || query.refreshError}<NativeButton className="dw-button" onClick={() => void query.refresh()}>Erneut laden</NativeButton></NativeDiv> : null}{query.loading && !query.data ? <NativeDiv className="dw-empty" role="status">Kategorien werden geladen …</NativeDiv> : rows.length ? <NativeDiv className="dw-table-wrap"><NativeTable className="dw-table"><NativeThead><NativeTr><NativeTh>Kategorie</NativeTh><NativeTh>Bereich</NativeTh></NativeTr></NativeThead><NativeTbody>{rows.map(row => <NativeTr key={row.id}><NativeTd>{row.label}</NativeTd><NativeTd>{TEMPLATE_MODULE_LABELS[row.moduleKey as TemplateModuleKey] ?? 'Allgemein'}</NativeTd></NativeTr>)}</NativeTbody></NativeTable></NativeDiv> : <NativeDiv className="dw-empty">Keine passenden Kategorien vorhanden.</NativeDiv>}</>}</TemplateWorkspaceFrame>;
}
