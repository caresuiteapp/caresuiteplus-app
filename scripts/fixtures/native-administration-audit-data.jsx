import React from 'react';
import * as existing from './administration-preview-mocks';
import {helgaSchneiderFull} from '../../src/data/demo/clients/helga-schneider';
import {getDemoEmployeePersonnelFile} from '../../src/data/demo/employeePersonnelFile';
import {getClientRecordTabsForClientContext} from '../../src/lib/clients/clientIntakeFieldRules';

// Local, fictional view fixtures. These hooks do not execute a fetcher or claim
// service acceptance. Unknown read contracts stay explicit errors; all writes
// must remain blocked by the preview runner as well.
export const administrationPortalAuditRoutes={
 'admin-audit-client-record':'/business/office/clients/client-001',
 'admin-audit-client-master-data':'/business/office/clients/client-001?tab=stammdaten',
 'admin-audit-client-billing':'/business/office/clients/client-001/billing',
 'admin-audit-client-billing-restricted':'/business/office/clients/client-001/billing',
 'admin-audit-client-service-records':'/business/office/clients/client-001/service-records',
 'admin-audit-client-timeline':'/business/office/clients/client-001/timeline',
 'admin-audit-employee-record':'/business/office/employees/employee-001',
 'admin-audit-employee-personnel':'/business/office/employees/employee-001/personnel',
 'admin-audit-invoices':'/business/office/invoices',
};
export const administrationPortalAuditAliases=[
 'src/hooks/useClientRecord','src/hooks/useClientFullDetail','src/hooks/useEmployeePersonnelFile',
 'src/hooks/core/useAsyncQuery','src/ai/useAiPageContext',
];
export const auditCaseId=()=>new URLSearchParams(location.search).get('screen')??'';
export const auditState=()=>new URLSearchParams(location.search).get('state')??'ready';
const isAudit=()=>auditCaseId().startsWith('admin-audit-');
const noop=()=>{};
export const denyAdministrationAuditWrite=async()=>({ok:false,error:'Die lokale Prüfung verändert keine Daten.'});
export const auditTenantId='11111111-1111-4111-8111-111111111111';
export const auditActorId='22222222-2222-4222-8222-222222222222';
const client={...structuredClone(helgaSchneiderFull),tenantId:auditTenantId,firstName:'Helene',lastName:'Musterfrau',core:{...structuredClone(helgaSchneiderFull.core),tenantId:auditTenantId,firstName:'Helene',lastName:'Musterfrau'}};
const employee=getDemoEmployeePersonnelFile('employee-001');
const permissions=['office.access','office.clients.view','office.clients.view_sensitive','office.employees.view','office.employees.view_sensitive','office.invoices.view','office.documents.view','clients.billing_profile.view'];
export function auditRuntimePermissions(){return auditState()==='denied'?[]:auditCaseId()==='admin-audit-client-billing-restricted'?permissions.filter(key=>key!=='clients.billing_profile.view'):permissions;}
function query(data){const state=auditState(),failed=['error','offline','denied'].includes(state),empty=state==='empty';return {data:failed||state==='loading'?null:empty?(Array.isArray(data)?[]:null):data,loading:state==='loading',refreshing:false,error:failed?(state==='offline'?'Keine Verbindung. Die Daten konnten nicht geladen werden.':state==='denied'?'Für diese Daten fehlen die erforderlichen Berechtigungen.':'Die angeforderten Daten konnten nicht geladen werden.'):null,refreshError:state==='stale'?'Die letzte Aktualisierung ist fehlgeschlagen.':null,refresh:noop,isLiveConnected:false};}
export function useAuth(){if(!isAudit())return existing.useAuth();return {authReady:true,isAuthenticated:true,portalSession:null,user:{id:auditActorId,email:'verwaltung@example.invalid'},profile:{id:auditActorId,tenantId:auditTenantId,roleKey:'business_admin',displayName:'Marlene Mustermann-Beispiel'},signOut:denyAdministrationAuditWrite};}
export function usePermissions(){if(!isAudit())return existing.usePermissions();const granted=auditRuntimePermissions();return {tenantId:auditTenantId,roleKey:'business_admin',permissions:granted,isReadOnly:true,roleLabel:'Verwaltung',can:key=>granted.includes(key),check:key=>({allowed:granted.includes(key)}),hasModuleGate:key=>['office','assist'].includes(key)};}
export const useServiceTenantId=()=>isAudit()?auditTenantId:existing.useServiceTenantId();
export function useClientRecord(){const result=query(client);return {...result,detail:result.data,careContexts:['daily_assistance'],tabs:result.loading?[]:getClientRecordTabsForClientContext(['daily_assistance'])};}
export function useClientFullDetail(){const result=query(client);return {...result,notFound:!result.loading&&!result.error&&!result.data,canViewSensitive:usePermissions().can('office.clients.view_sensitive')};}
export function useEmployeePersonnelFile(){const result=query(employee?{...structuredClone(employee),tenantId:auditTenantId}:null);return {...result,file:result.data};}
export const useAiPageContext=noop;
export const useLocalSearchParams=()=>{if(!isAudit())return existing.useLocalSearchParams();const href=new URL(administrationPortalAuditRoutes[auditCaseId()]??'/business','https://fixture.invalid'),parts=href.pathname.split('/');return {...Object.fromEntries(href.searchParams),...(parts.includes('clients')?{id:'client-001'}:parts.includes('employees')?{id:'employee-001'}:{})};};
export const usePathname=()=>isAudit()?new URL(administrationPortalAuditRoutes[auditCaseId()]??'/business','https://fixture.invalid').pathname:existing.usePathname();
export const useRouter=()=>existing.useRouter();
const invoice={id:'fixture-invoice',tenantId:auditTenantId,clientId:'client-001',clientName:'Helene Musterfrau',clientNumber:'K-0042',insuranceNumber:'',invoiceNumber:'RE-2026-0042',status:'partly_paid',invoiceDate:'2026-10-01',dueDate:'2026-10-15',servicePeriodStart:'2026-09-01',servicePeriodEnd:'2026-09-30',amountCents:152000,paidCents:52000,openCents:100000,billingModule:'assist',updatedAt:'2026-10-26T08:00:00Z',createdAt:'2026-10-01T08:00:00Z',recipient:{name:'Fiktive Pflegekasse Nord',street:'Beispielstraße',houseNumber:'24',postalCode:'30159',city:'Hannover',country:'Deutschland',email:'rechnung@example.invalid'},recipientType:'care_insurance',billingParty:'care_insurance',officeManaged:true,notes:null,footerText:null,includeProofs:false,selectedProofIds:[],lines:[],issues:[],pdfFilePath:null,cancellationReason:null,companySnapshot:null};
export function useAsyncQuery(_fetcher,_dependencies,options){if(!isAudit())return existing.useAsyncQuery();const key=options?.queryKey??'';if(key.startsWith('office-invoices:'))return query([invoice]);if(key.startsWith('client-assignments:'))return query([]);return {...query(null),loading:false,error:'Für diese zusätzliche Datenquelle liegt noch kein geprüfter Vorschauvertrag vor.'};}
export const useIsFocused=()=>true;
export const useNavigation=()=>existing.useNavigation();
export const usePreventRemove=noop;
export const useGlobalSearchParams=()=>({});
export const Link=existing.Link;
export const NavigationContext=existing.NavigationContext;
