import type { RoleKey, ServiceResult } from '@/types';
import type { PermissionKey } from '@/types/permissions';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { runService } from '@/lib/services/serviceRunner';
import { visitSupabaseRepository } from '@/lib/assist/repositories/visitRepository.supabase';
import { buildMobilityJournal, mapMobilityTrip, mobilityBerlinDate, mobilityMonthRange, mobilityText, mobilityTrackingPosition,
  type MobilityRow, type AssistMobilityJournal, type AssistMobilityTrip, type AssistMobilityTracking, type AssistMobilityTrackingRow } from './assistMobilityModel.web';
export type { AssistMobilityTrip, AssistMobilityJournal, AssistMobilityTracking, AssistMobilityTrackingRow } from './assistMobilityModel.web';
export type AssistMobilityScope = { tenantId: string; roleKey: RoleKey | null; effectivePermissions: readonly PermissionKey[]; now?: Date };
type RawResult = { data: unknown; error: unknown };
type RowsResult = { data: MobilityRow[]; error: unknown };
const PAGE = 500;
const JOURNAL_COLUMNS = 'id,tenant_id,employee_id,assignment_id,client_id,vehicle_id,route_type,purpose,status,started_at,ended_at,start_address,end_address,distance_final_km,distance_source,notes,updated_at';
const LEGACY_COLUMNS = 'id,tenant_id,employee_id,employee_name,vehicle_label,title,purpose,status,started_at,ended_at,start_address,end_address,distance_km,travel_type,updated_at';
function rows(value: unknown): value is MobilityRow[] { return Array.isArray(value) && value.every(item => item !== null && typeof item === 'object' && !Array.isArray(item)); }
function record(value: unknown): value is MobilityRow { return value != null && typeof value === 'object' && !Array.isArray(value); }
function failure(error: unknown, prefix: string): string { return `${prefix} ${toGermanSupabaseError(error)}`; }
function access(input: AssistMobilityScope, keys: PermissionKey[]): { ok: false; error: string } | null {
  const denied = guardServiceTenant(input.tenantId); if (denied) return denied;
  if (!input.roleKey || input.roleKey.endsWith('_portal') || !['assist.access', ...keys].every(key => input.effectivePermissions.includes(key as PermissionKey))) return { ok: false, error: 'Für diesen Bereich fehlt die erforderliche Berechtigung.' };
  if (input.now && !Number.isFinite(input.now.getTime())) return { ok: false, error: 'Der Abfragezeitpunkt ist ungültig.' };
  return null;
}
async function pages(makePage: (from: number, to: number) => PromiseLike<RawResult>): Promise<RowsResult> {
  const data: MobilityRow[] = [];
  try {
    for (let offset = 0; ; offset += PAGE) {
      const result = await makePage(offset, offset + PAGE - 1);
      if (result.error) return { data: [], error: result.error };
      if (!rows(result.data)) return { data: [], error: { message: 'Unvollständige Datenantwort.' } };
      data.push(...result.data); if (result.data.length < PAGE) return { data, error: null };
    }
  } catch (error) { return { data: [], error }; }
}
async function chunks(ids: string[], makePage: (group: string[], from: number, to: number) => PromiseLike<RawResult>): Promise<RowsResult> {
  const unique = [...new Set(ids)]; const data: MobilityRow[] = [];
  for (let offset = 0; offset < unique.length; offset += 100) {
    const result = await pages((from,to) => makePage(unique.slice(offset,offset+100),from,to));
    if (result.error) return result; data.push(...result.data);
  }
  return { data, error: null };
}
function database() { const client = getSupabaseClient(); if (!client) throw new Error('Die Datenverbindung ist nicht verfügbar.'); return client; }
function query(tenantId: string, table: string, columns: string) { return fromUnknownTable(database(), table).select(columns).eq('tenant_id', tenantId); }
function ids(records: MobilityRow[], field: string) { return records.map(row => mobilityText(row[field])).filter((id): id is string => Boolean(id)); }
async function metadata(scope: AssistMobilityScope, records: MobilityRow[]) {
  const warnings: string[] = [];
  const related = (table: string, columns: string, values: string[]) => chunks(values, (group,from,to) => query(scope.tenantId,table,columns).in('id',group).order('id').range(from,to));
  const [employees, clients, vehicles] = await Promise.all([
    scope.effectivePermissions.includes('office.employees.view') ? related('employees','id,tenant_id,first_name,last_name',ids(records,'employee_id')) : Promise.resolve({ data: [], error: null }),
    scope.effectivePermissions.includes('office.clients.view') ? related('clients','id,tenant_id,first_name,last_name',ids(records,'client_id')) : Promise.resolve({ data: [], error: null }),
    related('employee_logbook_vehicles','id,tenant_id,employee_id,plate',ids(records,'vehicle_id')),
  ]);
  if (employees.error) warnings.push('Mitarbeitendennamen konnten nicht geladen werden. Die Fahrten bleiben sichtbar.');
  if (clients.error) warnings.push('Klientennamen konnten nicht geladen werden. Die Fahrten bleiben sichtbar.');
  if (vehicles.error) warnings.push('Fahrzeugangaben konnten nicht geladen werden.');
  return { employees: employees.data, clients: clients.data, vehicles: vehicles.data, warnings };
}
/** Read-only, month-bounded canonical logbook plus preserved historical trips. */
export async function fetchAssistMobilityJournal(input: AssistMobilityScope & { month: string }): Promise<ServiceResult<AssistMobilityJournal>> {
  return runService(async () => {
    const denied = access(input,['assist.trips.view']); if (denied) return denied;
    const range = mobilityMonthRange(input.month); if (!range) return { ok: false, error: 'Bitte einen gültigen Monat auswählen.' };
    const period = (table: string, columns: string) => pages((from,to) => query(input.tenantId,table,columns).gte('started_at',range.start).lt('started_at',range.end).order('started_at',{ ascending:false }).order('id').range(from,to));
    const [canonical,legacy] = await Promise.all([period('employee_logbook_trips',JOURNAL_COLUMNS),period('trips',LEGACY_COLUMNS)]);
    if (canonical.error) return { ok:false,error:failure(canonical.error,'Das Fahrtenbuch konnte nicht vollständig geladen werden.') };
    const records = [...canonical.data,...legacy.data].filter(row=>row.tenant_id===input.tenantId);
    const context = await metadata(input,records);
    if (legacy.error) context.warnings.push('Frühere Fahrten konnten nicht geladen werden. Die Mitarbeitenden-Fahrtenbücher sind verfügbar.');
    if (records.some(row=>!mobilityText(row.id)||!Number.isFinite(Date.parse(String(row.started_at))))) context.warnings.push('Einige gespeicherte Fahrten enthalten kein gültiges Datum oder keine Kennung und können nicht angezeigt werden.');
    return { ok:true,data:buildMobilityJournal({tenantId:input.tenantId,month:input.month,canonical:canonical.data,legacy:legacy.data,...context,now:input.now}) };
  });
}
async function getTripRow(tenantId: string, id: string, source: 'logbook'|'legacy'): Promise<ServiceResult<MobilityRow|null>> {
  const result = await query(tenantId,source==='logbook'?'employee_logbook_trips':'trips',source==='logbook'?JOURNAL_COLUMNS:LEGACY_COLUMNS).eq('id',id).maybeSingle();
  if (result.error) return {ok:false,error:failure(result.error,'Die Fahrt konnte nicht geladen werden.')};
  const data:unknown=result.data;
  if (data == null) return {ok:true,data:null};
  if (!record(data) || data.tenant_id!==tenantId || data.id!==id) return {ok:false,error:'Die Fahrt gehört nicht zu diesem Arbeitsbereich.'};
  return {ok:true,data};
}
export async function fetchAssistMobilityTrip(input: AssistMobilityScope & { id:string; source?:'logbook'|'legacy' }): Promise<ServiceResult<AssistMobilityTrip>> {
  return runService(async()=>{
    const denied=access(input,['assist.trips.view']); if(denied)return denied;
    if (!input.id.trim()) return {ok:false,error:'Die Fahrtkennung fehlt.'};
    let source=input.source??'logbook'; let result=await getTripRow(input.tenantId,input.id,source);
    if (!result.ok) return result;
    if (!result.data&&!input.source){source='legacy';result=await getTripRow(input.tenantId,input.id,source);}
    if (!result.ok)return result;
    if (!result.data)return {ok:false,error:'Diese Fahrt wurde nicht gefunden oder ist nicht mehr freigegeben.'};
    return {ok:true,data:mapMobilityTrip(result.data,source,await metadata(input,[result.data]))};
  });
}
/** Audited correction, without starting/stopping GPS or changing assignment/time/vehicle links. */
export async function correctAssistMobilityTrip(input: AssistMobilityScope & { id:string;employeeId:string;expectedUpdatedAt:string|null;distanceKm:number;purpose:string;startAddress:string;endAddress:string;reason:string }): Promise<ServiceResult<AssistMobilityTrip>> {
  return runService(async()=>{
    const denied=access(input,['assist.trips.view','assist.trips.manage','office.employees.edit']); if(denied)return denied;
    if (!Number.isFinite(input.distanceKm)||input.distanceKm<0||input.distanceKm>100000) return {ok:false,error:'Bitte eine gültige Strecke in Kilometern angeben.'};
    if(input.purpose.trim().length<3||input.reason.trim().length<3)return {ok:false,error:'Bitte Fahrtzweck und Änderungsgrund mit mindestens drei Zeichen angeben.'};
    if(input.purpose.length>2000||input.reason.length>2000||input.startAddress.length>1000||input.endAddress.length>1000)return {ok:false,error:'Die Angaben sind zu lang. Bitte die Beschreibung kürzen.'};
    const current=await getTripRow(input.tenantId,input.id,'logbook');if(!current.ok)return current;
    const row=current.data;
    if(!row||row.employee_id!==input.employeeId)return {ok:false,error:'Diese Fahrt ist nicht für die gewählte Person freigegeben.'};
    if(!['completed','confirmed','corrected','confirmation_required','review_required'].includes(String(row.status))||!mobilityText(row.ended_at))return {ok:false,error:'Nur beendete Fahrten können korrigiert werden.'};
    if(row.status!=='review_required'&&(!Number.isFinite(Date.parse(String(row.started_at)))||!Number.isFinite(Date.parse(String(row.ended_at)))||Date.parse(String(row.ended_at))<=Date.parse(String(row.started_at))))return {ok:false,error:'Die gespeicherten Fahrtzeiten müssen zuerst vollständig geprüft werden.'};
    if(!input.expectedUpdatedAt||row.updated_at!==input.expectedUpdatedAt)return {ok:false,error:'Die Fahrt wurde inzwischen geändert. Bitte neu laden und die Angaben prüfen.'};
    const vehicleId=mobilityText(row.vehicle_id);
    if(!vehicleId)return {ok:false,error:'Für die Fahrt fehlt die Fahrzeugzuordnung. Bitte zuerst das Fahrtenbuch der Person prüfen.'};
    const vehicle=await query(input.tenantId,'employee_logbook_vehicles','id,tenant_id,employee_id').eq('id',vehicleId).eq('employee_id',input.employeeId).maybeSingle();
    if(vehicle.error)return {ok:false,error:failure(vehicle.error,'Die Fahrzeugzuordnung konnte nicht geprüft werden.')};
    const vehicleData:unknown=vehicle.data;
    if(!record(vehicleData)||vehicleData.id!==vehicleId||vehicleData.tenant_id!==input.tenantId||vehicleData.employee_id!==input.employeeId)return {ok:false,error:'Das Fahrzeug ist dieser Person nicht zugeordnet. Bitte zuerst das Fahrtenbuch prüfen.'};
    const auth=await database().auth.getUser();if(auth.error||!auth.data.user)return {ok:false,error:'Bitte erneut anmelden, bevor Sie eine Fahrt korrigieren.'};
    const now=new Date().toISOString();
    const saved=await fromUnknownTable(database(),'employee_logbook_trips').update({
      purpose:input.purpose.trim(),start_address:input.startAddress.trim()||null,end_address:input.endAddress.trim()||null,
      distance_final_km:input.distanceKm,distance_source:'office_corrected',route_quality_status:'corrected',status:row.status==='review_required'?'review_required':'corrected',
      corrected_at:now,corrected_by:auth.data.user.id,correction_reason:input.reason.trim(),
      previous_values:{purpose:row.purpose,start_address:row.start_address,end_address:row.end_address,distance_final_km:row.distance_final_km,status:row.status},updated_at:now,
    }).eq('tenant_id',input.tenantId).eq('employee_id',input.employeeId).eq('id',input.id).eq('status',String(row.status)).eq('updated_at',input.expectedUpdatedAt).select(JOURNAL_COLUMNS).maybeSingle();
    if(saved.error)return {ok:false,error:failure(saved.error,'Die Korrektur wurde nicht gespeichert.')};
    const savedData:unknown=saved.data;
    if(!record(savedData)||savedData.id!==input.id||savedData.tenant_id!==input.tenantId||savedData.employee_id!==input.employeeId)return {ok:false,error:'Die Korrektur wurde nicht gespeichert. Bitte die Fahrt neu laden.'};
    return {ok:true,data:mapMobilityTrip(savedData,'logbook',await metadata(input,[savedData]))};
  });
}

/** Real active sessions only. Never turns a heartbeat or a historical GPS fix into a live position. */
export async function fetchAssistMobilityTracking(input: AssistMobilityScope): Promise<ServiceResult<AssistMobilityTracking>> {
  return runService(async()=>{
    const denied=access(input,['assist.tracking.view','assist.assignments.view']);if(denied)return denied;
    const now=input.now??new Date(); const today=mobilityBerlinDate(now);
    const [visitsResult,sessions]=await Promise.all([
      // Scope and current effective permissions were checked above. The repository keeps
      // canonical execution states without re-applying a stale static role template.
      visitSupabaseRepository.list(input.tenantId),
      pages((from,to)=>query(input.tenantId,'assist_tracking_sessions','id,tenant_id,visit_id,employee_id,consent_granted_at,started_at,ended_at,is_active,updated_at').eq('is_active',true).order('started_at',{ascending:false}).order('id').range(from,to)),
    ]);
    if(!visitsResult.ok)return visitsResult;
    if(sessions.error)return {ok:false,error:failure(sessions.error,'Die aktiven Standortfreigaben konnten nicht geladen werden.')};
    const scopedSessions=sessions.data.filter(row=>row.tenant_id===input.tenantId&&row.is_active===true&&!row.ended_at&&mobilityText(row.id)&&mobilityText(row.visit_id));
    const employeeIds=ids(scopedSessions,'employee_id');
    const consents=await chunks(employeeIds,(group,from,to)=>query(input.tenantId,'employee_location_consents','id,tenant_id,employee_id,consent_granted_at,revoked_at,updated_at').in('employee_id',group).order('id').range(from,to));
    if(consents.error)return {ok:false,error:failure(consents.error,'Die Standortfreigaben konnten nicht geprüft werden.')};
    const consentByEmployee=new Map(consents.data.filter(row=>row.tenant_id===input.tenantId).map(row=>[String(row.employee_id),row]));
    const allowedSession=(session:MobilityRow)=>{
      const consent=consentByEmployee.get(String(session.employee_id));
      // A recorded revocation overrides an old visit/session consent.
      if(consent?.revoked_at)return false;
      const grantedAt=mobilityText(consent?.consent_granted_at)??mobilityText(session.consent_granted_at);
      return Boolean(grantedAt&&Number.isFinite(Date.parse(grantedAt))&&Date.parse(grantedAt)<=now.getTime());
    };
    const sessionByVisit=new Map<string,MobilityRow>();
    for(const session of scopedSessions)if(!sessionByVisit.has(String(session.visit_id)))sessionByVisit.set(String(session.visit_id),session);
    const visits=visitsResult.data.filter(visit=>visit.tenantId===input.tenantId&&(mobilityBerlinDate(new Date(visit.scheduledStart))===today||sessionByVisit.has(visit.id)));
    const activeStatuses=['unterwegs','angekommen','gestartet','pausiert'];
    const permittedSessions=[...sessionByVisit.values()].filter(session=>allowedSession(session)&&visits.some(visit=>visit.id===session.visit_id&&visit.employeeId===session.employee_id&&activeStatuses.includes(visit.assignmentStatus)));
    // Each session receives its own newest point. This is bounded by active sessions and cannot
    // lose a quiet employee behind the 1,000-row limit of a tenant-wide GPS query.
    const pointResults=await Promise.all(permittedSessions.map(async session=>{
      const result=await query(input.tenantId,'assist_location_points','id,tenant_id,visit_id,session_id,latitude,longitude,accuracy_meters,recorded_at').eq('visit_id',String(session.visit_id)).eq('session_id',String(session.id)).order('recorded_at',{ascending:false}).order('id',{ascending:false}).limit(1);
      if(result.error)throw result.error;
      const data:unknown=result.data;
      if(!rows(data))throw new Error('Unvollständige Standortantwort.');
      const point=data[0];
      return [String(session.id),point&&point.tenant_id===input.tenantId&&point.session_id===session.id&&point.visit_id===session.visit_id&&Date.parse(String(point.recorded_at))>=Date.parse(String(session.started_at))?point:null] as const;
    }));
    const points=new Map(pointResults);
    const warnings:string[]=[];
    if(scopedSessions.some(session=>!visits.some(visit=>visit.id===session.visit_id)))warnings.push('Für einzelne Standortfreigaben ist der zugehörige Einsatz nicht verfügbar. Die Positionen bleiben ausgeblendet.');
    const resultRows:AssistMobilityTrackingRow[]=visits.map(visit=>{
      const session=sessionByVisit.get(visit.id); const matches=Boolean(session&&session.employee_id===visit.employeeId);
      const visible=activeStatuses.includes(visit.assignmentStatus);
      const projected=mobilityTrackingPosition({active:matches,visible,consent:Boolean(session&&allowedSession(session)),point:session?points.get(String(session.id))??null:null,now});
      return {id:visit.id,visitId:visit.id,employeeId:visit.employeeId,employeeName:visit.employeeName||'Nicht zugeordnet',clientName:visit.clientName||null,title:visit.title,
        statusLabel:({geplant:'Geplant',bestaetigt:'Bestätigt',unterwegs:'Unterwegs',angekommen:'Angekommen',gestartet:'Im Einsatz',pausiert:'Pause',beendet:'Beendet',dokumentation_offen:'Dokumentation offen',unterschrift_offen:'Unterschrift offen',abgeschlossen:'Abgeschlossen',abgesagt:'Abgesagt'} as Record<string,string>)[visit.assignmentStatus]??'Status prüfen',
        ...projected,plannedStartAt:visit.scheduledStart,plannedEndAt:visit.scheduledEnd,detailHref:`/assist/assignments/${encodeURIComponent(visit.id)}`};
    });
    const order={live:0,stale:1,invalid:2,waiting:3,consent_missing:4,inactive:5};
    resultRows.sort((a,b)=>order[a.trackingState]-order[b.trackingState]||a.plannedStartAt.localeCompare(b.plannedStartAt));
    return {ok:true,data:{rows:resultRows,generatedAt:now.toISOString(),warnings}};
  });
}
