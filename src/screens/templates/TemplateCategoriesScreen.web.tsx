import { useState } from 'react';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { fetchTemplateCategories } from '@/lib/templates/templateCategoriesService';
import { TEMPLATE_MODULE_LABELS, TemplateAccessMessage, TemplateWorkspaceFrame } from '@/components/templates/TemplateWorkspace.web';
import type {TemplateModuleKey} from '@/types/templates';
export function TemplateCategoriesScreen(){
  const tenantId=useServiceTenantId();const {profile}=useAuth();const {can}=usePermissions();const [search,setSearch]=useState('');
  const query=useAsyncQuery(()=>fetchTemplateCategories(tenantId!,profile?.roleKey),[tenantId,profile?.roleKey],{enabled:!!tenantId&&can('office.catalogs.view'),queryKey:JSON.stringify([tenantId,profile?.roleKey])});
  const rows=(query.data??[]).filter(row=>`${row.label} ${TEMPLATE_MODULE_LABELS[row.moduleKey as TemplateModuleKey]??''}`.toLowerCase().includes(search.trim().toLowerCase()));
  return <TemplateWorkspaceFrame title="Vorlagenkategorien" description="Die gespeicherte Zuordnung Ihrer Textvorlagen zu den Arbeitsbereichen.">{!can('office.catalogs.view')?<TemplateAccessMessage/>:!tenantId?<div className="dw-alert">Bitte zuerst ein Unternehmen auswählen.</div>:<><label className="dw-field">Suche<input className="dw-input" type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Kategorie suchen"/></label>{query.error||query.refreshError?<div className="dw-alert" data-tone="danger" role="alert">{query.error||query.refreshError}<button className="dw-button" onClick={()=>void query.refresh()}>Erneut laden</button></div>:null}{query.loading&&!query.data?<div className="dw-empty" role="status">Kategorien werden geladen …</div>:rows.length?<div className="dw-table-wrap"><table className="dw-table"><thead><tr><th>Kategorie</th><th>Bereich</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td>{row.label}</td><td>{TEMPLATE_MODULE_LABELS[row.moduleKey as TemplateModuleKey]??'Allgemein'}</td></tr>)}</tbody></table></div>:<div className="dw-empty">Keine passenden Kategorien vorhanden.</div>}</>}</TemplateWorkspaceFrame>;
}
