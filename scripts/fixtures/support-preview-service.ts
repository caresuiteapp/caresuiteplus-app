// Synthetic data adapter for browser QA; no production account or API is used.
export const SUPPORT_SCOPES = { 'company.read':'Unternehmensdaten einsehen','company.write':'Unternehmensdaten bearbeiten','assignments.read':'Einsätze, Zeiten und Dokumentationsstatus einsehen','assignments.notes.write':'Interne Einsatznotizen bearbeiten','clients.read':'Klienten: Name, Nummer und Status einsehen','employees.read':'Personal: Name, Nummer, Status und Portalstatus einsehen' };
export const SUPPORT_STATUS = {open:'Offen',waiting_tenant:'Antwort vom Unternehmen',waiting_support:'Antwort vom Support',resolved:'Gelöst',closed:'Geschlossen'};
export const newSupportNonce=()=>crypto.randomUUID();
export const isSupportAccessActive=(request:any,now=Date.now())=>request.status==='approved'&&Date.parse(request.expires_at)>now;
export function withRequiredReadScopes(scopes:string[]){return [...new Set([...scopes,...(scopes.includes('company.write')?['company.read']:[]),...(scopes.includes('assignments.notes.write')?['assignments.read']:[])])];}
let messages=[{id:'m1',body:'Beim Öffnen eines Einsatzes wird die gespeicherte Unterschrift noch geprüft. Wie können wir den Status klären?',author_kind:'tenant',author_name:'Testverwaltung',created_at:new Date().toISOString(),attachments:[]},{id:'m2',body:'Vielen Dank für die Beschreibung. Bitte geben Sie uns die Einsatzansicht für 30 Minuten frei. Wir prüfen den gespeicherten Status.',author_kind:'platform',author_name:'CareSuite Support',created_at:new Date().toISOString(),attachments:[]}];
let tickets=[{id:'ticket1',number:1042,subject:'Rückfrage zum gespeicherten Einsatz',tenant_id:'test-company',tenant_name:'Musterbetrieb Pflege',status:'waiting_tenant',category:'technical',priority:'normal',assigned_name:'CareSuite Support',updated_at:new Date().toISOString(),last_message:messages[1].body}];
let requests=[{id:'grant1',ticket_id:'ticket1',requester_name:'CareSuite Support',reason:'Gespeicherten Einsatzstatus prüfen und die Ursache des Ladezustands ermitteln.',scopes:['assignments.read'],status:'requested',duration_minutes:30,created_at:new Date().toISOString(),expires_at:null,is_requester:true}];
export async function supportRpc(name:string,args:any={}){
 const platform=new URLSearchParams(location.search).get('platform')==='1';
 if(name==='support_list_tickets')return{tickets:tickets.filter(t=>!args.p_status||t.status===args.p_status),can_create:!platform,can_manage:true,can_support_write:platform};
 if(name==='support_get_ticket')return{ticket:tickets.find(t=>t.id===args.p_ticket_id),messages,requests,audit:[{event:'ticket.created',details:{},created_at:new Date().toISOString()},{event:'access.requested',details:{},created_at:new Date().toISOString()}],can_approve:!platform,can_write:true,can_support_write:platform};
 if(name==='support_send_message'){messages=[...messages,{id:crypto.randomUUID(),body:args.p_body,author_kind:platform?'platform':'tenant',author_name:platform?'CareSuite Support':'Testverwaltung',created_at:new Date().toISOString(),attachments:[]}];return{};}
 if(name==='support_create_ticket'){const ticket={...tickets[0],id:crypto.randomUUID(),number:1043,subject:args.p_subject,last_message:args.p_body};tickets=[ticket,...tickets];return ticket;}
 if(name==='support_decide_access'){requests=requests.map(r=>r.id===args.p_request_id?{...r,status:args.p_decision==='approve'?'approved':'revoked',expires_at:new Date(Date.now()+1800000).toISOString()}:r) as any;return{};}
 return{};
}
export const subscribeSupport=()=>()=>undefined;
export const pickSupportAttachment=async()=>null;
export const removeSupportDraftAttachment=async()=>undefined;
export const downloadSupportAttachment=async()=>undefined;

export const isSupportPermissionError=()=>false;
