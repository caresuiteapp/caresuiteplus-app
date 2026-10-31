import {getSupabaseClient} from '@/lib/supabase/client';
import {guardServiceTenant} from '@/lib/services/liveServiceGuard';
import {getServiceMode} from '@/lib/services/mode';
import {UUID} from './sources';
import {readEmployeeCommand,readEmployeeRegistration,readEmployeeRequestStatus,readEmployeeWorkspace,EmployeeWriteError,type EmployeeCommand} from './monthlyEmployees';

async function clientFor(tenantId:string,actorId:string){
 if(!UUID.test(tenantId)||!UUID.test(actorId)||guardServiceTenant(tenantId)||getServiceMode()!=='supabase')throw new EmployeeWriteError('Bitte mit Ihrem persönlichen Unternehmenszugang anmelden.',false);
 const client=getSupabaseClient();if(!client)throw new EmployeeWriteError('Die Beschäftigtenzuordnung benötigt eine verbundene Datenbank.',false);
 const {data,error}=await client.auth.getSession();
 if(error||!data.session||data.session.user.id!==actorId)throw new EmployeeWriteError('Die Anmeldung wurde geändert. Bitte den Bereich neu öffnen.',false);
 return client;
}
function failure(error:unknown):never{
 const code=(error as {code?:string})?.code;
 const message=['42P01','42883','PGRST202','PGRST205'].includes(code??'')?'Die GKV-Beschäftigtenzuordnung ist für dieses Unternehmen noch nicht freigeschaltet.'
  :code==='42501'?'Persönliche Zuordnung oder unabhängiger Prüfauftrag fehlt. Bitte den Zugang prüfen.'
  :['40001','23505'].includes(code??'')?'Die Zuordnung wurde geändert oder ist bereits vorhanden. Bitte den gespeicherten Stand aktualisieren.'
  :code==='22023'?'Bitte Nummer, Nachweisreferenz, Prüfvermerk und Gültigkeit prüfen.'
  :'Die Antwort konnte nicht eindeutig zugeordnet werden. Bitte den Auftragsstatus prüfen.';
 throw new EmployeeWriteError(message,['42501','40001','23505','22023','42P01','42883','PGRST202','PGRST205'].includes(code??'')===false);
}
async function rpc(tenantId:string,actorId:string,name:string,input:Record<string,unknown>){
 const client=await clientFor(tenantId,actorId);
 const call=client.rpc.bind(client) as unknown as (name:string,input:Record<string,unknown>)=>Promise<{data:unknown;error:unknown}>;
 const {data,error}=await call(name,{t:tenantId,...input});if(error)failure(error);return data;
}
export async function loadEmployeeRegistrations(tenantId:string,actorId:string,after:string|null=null){
 return readEmployeeWorkspace(await rpc(tenantId,actorId,'gkv_employee_workspace',{p_after:after}),tenantId,actorId,after);
}
export async function commandEmployeeRegistration(tenantId:string,actorId:string,command:EmployeeCommand,requestId:string){
 const c=readEmployeeCommand(command);if(!UUID.test(requestId))throw new EmployeeWriteError('Ungültiger Auftrag.',false);
 return readEmployeeRegistration(await rpc(tenantId,actorId,'gkv_employee_command',{p_request:requestId,p_action:c.action,p_input:c.input}),tenantId);
}
export async function employeeRequestStatus(tenantId:string,actorId:string,requestId:string){
 if(!UUID.test(requestId))throw new EmployeeWriteError('Ungültiger Auftrag.',false);
 return readEmployeeRequestStatus(await rpc(tenantId,actorId,'gkv_employee_request_status',{p_request:requestId}),tenantId,requestId);
}
