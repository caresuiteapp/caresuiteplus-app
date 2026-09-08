import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { confirmAction } from '@/lib/platform/confirmAction';
import { SUPPORT_SCOPES, isSupportAccessActive, isSupportPermissionError, supportRpc, withRequiredReadScopes, type SupportAccess, type SupportDetail, type SupportRecord, type SupportScope } from '@/lib/support/supportService';
import { SupportButton, SupportField, supportDate, supportStyles as s } from './SupportPrimitives';

const FIELD_LABELS: Record<string,string> = { name:'Unternehmensname',legal_name:'Juristischer Name',street:'Straße',house_number:'Hausnummer',postal_code:'Postleitzahl',city:'Ort',email:'E-Mail',phone:'Telefon',website:'Website',title:'Einsatz',assignment_date:'Datum',planned_start_at:'Geplanter Beginn',planned_end_at:'Geplantes Ende',actual_start_at:'Tatsächlicher Beginn',actual_end_at:'Tatsächliches Ende',canonical_status:'Einsatzstatus',documentation_status:'Dokumentation',proof_status:'Nachweis',internal_notes:'Interne Notizen',client_number:'Klientennummer',employee_number:'Personalnummer',first_name:'Vorname',last_name:'Nachname',status:'Status',portal_enabled:'Portal aktiv' };
const AUDIT_LABELS: Record<string,string> = { 'ticket.created':'Ticket erstellt','ticket.status':'Ticketstatus geändert','ticket.assigned':'Support-Betreuung zugewiesen','message.sent':'Nachricht gesendet','access.requested':'Zugriff angefordert','access.approve':'Zugriff durch Unternehmen bestätigt','access.reject':'Zugriff abgelehnt','access.revoke':'Zugriff widerrufen','workspace.read':'Freigegebene Daten eingesehen','workspace.updated':'Freigegebene Daten bearbeitet' };

export function SupportAccessPanel({ detail, platformMode, busy, run, refresh, onDirtyChange }: { detail: SupportDetail; platformMode: boolean; busy: boolean; run: (action: () => Promise<void>) => Promise<void>; refresh: () => Promise<void>; onDirtyChange?: (dirty: boolean) => void }) {
  const [reason,setReason] = useState('');
  const [scopes,setScopes] = useState<SupportScope[]>(['company.read']);
  const [minutes,setMinutes] = useState(60);
  const [now,setNow] = useState(Date.now());
  const [workspace,setWorkspace] = useState<{ requestId:string; scope:SupportScope; rows:SupportRecord[]; offset:number } | null>(null);
  const [editing,setEditing] = useState<SupportRecord | null>(null);
  const [patch,setPatch] = useState<Record<string,string>>({});
  const hasEdits = !!editing && Object.keys(patch).length > 0;
  useEffect(() => { onDirtyChange?.(hasEdits || !!reason.trim()); }, [hasEdits, reason, onDirtyChange]);
  useEffect(() => () => { onDirtyChange?.(false); }, [onDirtyChange]);
  useEffect(() => { const timer=setInterval(() => setNow(Date.now()),1000); return () => clearInterval(timer); },[]);
  useEffect(() => {
    if (workspace && !detail.requests.some(request => request.id===workspace.requestId && isSupportAccessActive(request,now))) { setWorkspace(null); setEditing(null); setPatch({}); }
  },[detail.requests,now,workspace]);
  const toggle = (scope:SupportScope) => setScopes(current => current.includes(scope) ? current.filter(value => value!==scope && !(scope==='company.read' && value==='company.write') && !(scope==='assignments.read' && value==='assignments.notes.write')) : withRequiredReadScopes([...current,scope]));
  const confirmDiscard = (message: string) => !hasEdits || confirmAction({ title: 'Ungespeicherte Bearbeitung', message, confirmLabel: 'Änderungen verwerfen' });
  const closeWorkspace = () => run(async () => {
    if (!await confirmDiscard('Die ungespeicherten Änderungen verwerfen und den Arbeitsbereich schließen?')) return;
    setWorkspace(null); setEditing(null); setPatch({});
  });
  const editRecord = (record: SupportRecord) => run(async () => {
    if (editing?.id === record.id) return;
    if (!await confirmDiscard('Die ungespeicherten Änderungen verwerfen und einen anderen Datensatz bearbeiten?')) return;
    setEditing(record); setPatch({});
  });
  const cancelEditing = () => run(async () => {
    if (!await confirmDiscard('Die ungespeicherten Änderungen verwerfen und die Bearbeitung beenden?')) return;
    setEditing(null); setPatch({});
  });
  const decide = (request:SupportAccess,decision:'approve'|'reject'|'revoke') => run(async () => {
    const message=decision==='approve' ? `${request.requester_name} erhält für ${request.duration_minutes} Minuten diese Rechte:\n\n${request.scopes.map(scope => SUPPORT_SCOPES[scope]).join('\n')}\n\nGrund: ${request.reason}\n\nDie Freigabe gilt nur für dieses Ticket und kann jederzeit widerrufen werden.` : decision==='reject' ? 'Die Anfrage ablehnen? Es wird kein Zugriff erteilt.' : 'Den Zugriff zu diesem Ticket jetzt beenden? Weitere Datenaufrufe und Änderungen werden sofort gesperrt.';
    if (!await confirmAction({title:decision==='approve'?'Support-Zugriff ausdrücklich freigeben':decision==='reject'?'Zugriff ablehnen':'Freigabe widerrufen',message,confirmLabel:decision==='approve'?'Zugriff freigeben':'Bestätigen'})) return;
    await supportRpc('support_decide_access',{p_request_id:request.id,p_decision:decision}); await refresh();
  });
  const loadWorkspace=(requestId:string,scope:SupportScope,offset=0)=>run(async()=>{
    if (!await confirmDiscard('Die ungespeicherten Änderungen verwerfen und eine andere Datenansicht öffnen?')) return;
    try {
      const result=await supportRpc<{rows:SupportRecord[]}>('support_workspace_read',{p_request_id:requestId,p_scope:scope,p_offset:offset});
      setEditing(null); setPatch({}); setWorkspace({requestId,scope,offset,rows:result.rows});
    } catch(cause) { if (isSupportPermissionError(cause)) {setWorkspace(null);setEditing(null);setPatch({});} throw cause; }
  });
  const save=()=>run(async()=>{
    if (!workspace || !editing) return;
    const scope=workspace.scope==='company.read'?'company.write':'assignments.notes.write';
    if (!await confirmAction({title:'Änderung im Unternehmen speichern',message:'Diese Änderung wird im freigegebenen Unternehmensdatensatz gespeichert und am Ticket protokolliert.',confirmLabel:'Änderung speichern'})) return;
    const current=workspace;
    try {
      await supportRpc('support_workspace_update',{p_request_id:current.requestId,p_scope:scope,p_record_id:editing.id,p_expected_updated_at:editing.updated_at,p_patch:patch});
      setEditing(null);setPatch({});
      const result=await supportRpc<{rows:SupportRecord[]}>('support_workspace_read',{p_request_id:current.requestId,p_scope:current.scope,p_offset:current.offset});
      setWorkspace({...current,rows:result.rows});await refresh();
    } catch(cause) {if (isSupportPermissionError(cause)) {setWorkspace(null);setEditing(null);setPatch({});} throw cause;}
  });
  const workspaceRequest=detail.requests.find(request=>request.id===workspace?.requestId);
  return <>
    <View style={s.section}><Text accessibilityRole="header" style={s.heading}>Zugriffsfreigaben</Text><Text style={s.copy}>{platformMode ? 'Zusätzlichen Datenzugriff können Sie hier anfragen. Erst die berechtigte Unternehmensverwaltung erteilt die Freigabe; sie gilt nur für dieses Ticket und die bestätigte Dauer.' : detail.can_approve ? 'Sie bestimmen, welche Daten der Support sehen oder bearbeiten darf. Ohne Bestätigung gibt es keinen Zugriff auf weitere Unternehmensdaten.' : 'Zusätzlichen Zugriff kann nur Ihre berechtigte Unternehmensverwaltung freigeben. Ohne deren Bestätigung kann der Support keine weiteren Unternehmensdaten einsehen.'}</Text>
      {!detail.requests.length ? <Text style={s.small}>Zu diesem Ticket wurde noch kein zusätzlicher Zugriff angefordert.</Text> : null}
      {detail.requests.map(request=>{
        const active=isSupportAccessActive(request,now);
        const pending=request.status==='requested' && Date.parse(request.created_at)+86400000>now;
        const status=active?'Freigabe aktiv':request.status==='approved'?'Abgelaufen':request.status==='revoked'?'Widerrufen / beendet':request.status==='rejected'?'Abgelehnt':pending?'Wartet auf Bestätigung':'Anfrage abgelaufen';
        return <View key={request.id} style={s.notice}><View style={s.row}><Text style={s.label}>{request.requester_name}</Text><Text style={s.eyebrow}>{status}</Text></View><Text style={s.copy}>{request.reason}</Text>{request.scopes.map(scope=><Text key={scope} style={s.copy}>• {SUPPORT_SCOPES[scope]}</Text>)}<Text style={s.small}>{request.expires_at?`Bis ${supportDate(request.expires_at)}`:`Dauer nach Bestätigung: ${request.duration_minutes} Minuten`}</Text>
          {detail.can_approve && pending ? <View style={s.chips}><SupportButton label="Zugriff freigeben" disabled={busy} onPress={()=>void decide(request,'approve')} /><SupportButton secondary label="Ablehnen" disabled={busy} onPress={()=>void decide(request,'reject')} /></View> : null}
          {detail.can_approve && active ? <SupportButton secondary label="Freigabe sofort widerrufen" disabled={busy} onPress={()=>void decide(request,'revoke')} /> : null}
          {!detail.can_approve && !platformMode && pending ? <Text style={s.small}>Die Unternehmensverwaltung mit Support-Berechtigung kann diese Anfrage hier bestätigen.</Text> : null}
          {platformMode && request.is_requester && active ? <View style={s.chips}>{request.scopes.filter(scope=>scope.endsWith('.read')).map(scope=><SupportButton key={scope} secondary label={SUPPORT_SCOPES[scope]} disabled={busy} onPress={()=>void loadWorkspace(request.id,scope)} />)}</View> : null}
        </View>;
      })}
      {platformMode && detail.can_support_write && !['resolved','closed'].includes(detail.ticket.status) ? <View style={s.composer}><Text style={s.label}>Zusätzlichen Zugriff anfordern</Text><SupportField disabled={busy} label="Warum wird dieser Zugriff benötigt?" value={reason} onChangeText={setReason} multiline maxLength={1000} />{(Object.keys(SUPPORT_SCOPES) as SupportScope[]).map(scope=><Pressable key={scope} accessibilityRole="checkbox" accessibilityState={{checked:scopes.includes(scope),disabled:busy}} disabled={busy} onPress={()=>toggle(scope)} style={s.row}><Text style={s.copy}>{scopes.includes(scope)?'☑':'☐'} {SUPPORT_SCOPES[scope]}</Text></Pressable>)}<Text style={s.label}>Dauer der Freigabe</Text><View style={s.chips}>{[15,30,60,120].map(value=><SupportButton key={value} label={`${value} Minuten`} secondary={minutes!==value} disabled={busy} onPress={()=>setMinutes(value)} />)}</View><SupportButton label="Freigabe beim Unternehmen anfragen" disabled={busy || reason.trim().length<10 || !scopes.length} onPress={()=>void run(async()=>{await supportRpc('support_request_access',{p_ticket_id:detail.ticket.id,p_reason:reason.trim(),p_scopes:withRequiredReadScopes(scopes),p_duration_minutes:minutes});setReason('');await refresh();})} /></View>:null}
    </View>
    {workspace && workspaceRequest && isSupportAccessActive(workspaceRequest,now) ? <View style={s.section}><Text accessibilityRole="header" style={s.heading}>Freigegebener Arbeitsbereich</Text><View style={s.notice}><Text style={s.label}>{detail.ticket.tenant_name} · Ticket #{detail.ticket.number}</Text><Text style={s.copy}>{SUPPORT_SCOPES[workspace.scope]}</Text><Text style={s.small}>Zugriff bis {supportDate(workspaceRequest.expires_at!)}. Jeder Aufruf wird geprüft und protokolliert.</Text><SupportButton secondary label="Arbeitsbereich schließen" disabled={busy} onPress={()=>void closeWorkspace()} /></View>
      {!workspace.rows.length?<Text style={s.copy}>Keine Datensätze in dieser Ansicht.</Text>:null}
      {workspace.rows.slice(0,50).map(record=><View key={record.id} style={s.message}><Text style={s.label}>{String(record.name||record.title||[record.first_name,record.last_name].filter(Boolean).join(' ')||'Datensatz')}</Text>{Object.entries(record).filter(([key])=>FIELD_LABELS[key]).map(([key,value])=><View key={key} style={s.row}><Text style={s.small}>{FIELD_LABELS[key]}</Text><Text selectable style={s.copy}>{typeof value==='boolean'?(value?'Ja':'Nein'):value==null?'—':String(value)}</Text></View>)}
        {((workspace.scope==='company.read' && workspaceRequest.scopes.includes('company.write'))||(workspace.scope==='assignments.read' && workspaceRequest.scopes.includes('assignments.notes.write'))) ? <SupportButton secondary label={workspace.scope==='company.read'?'Unternehmensdaten bearbeiten':'Interne Notiz bearbeiten'} disabled={busy} onPress={()=>void editRecord(record)}/>:null}
        {editing?.id===record.id ? <View style={s.composer}>{(workspace.scope==='company.read'?['name','legal_name','street','house_number','postal_code','city','email','phone','website']:['internal_notes']).map(key=><SupportField key={key} disabled={busy} label={FIELD_LABELS[key]} value={patch[key]??String(record[key]??'')} onChangeText={value=>setPatch(current=>({...current,[key]:value}))} multiline={key==='internal_notes'} maxLength={key==='internal_notes'?10000:200}/>)}<View style={s.chips}><SupportButton label="Änderung speichern" disabled={busy || !Object.keys(patch).length} onPress={()=>void save()}/><SupportButton secondary label="Bearbeitung abbrechen" disabled={busy} onPress={()=>void cancelEditing()}/></View></View>:null}
      </View>)}
      {workspace.scope!=='company.read'?<View style={s.chips}><SupportButton secondary label="Vorherige Datensätze" disabled={busy || !workspace.offset} onPress={()=>void loadWorkspace(workspace.requestId,workspace.scope,Math.max(0,workspace.offset-50))}/><SupportButton secondary label="Weitere Datensätze" disabled={busy || workspace.rows.length<=50} onPress={()=>void loadWorkspace(workspace.requestId,workspace.scope,workspace.offset+50)}/></View>:null}
    </View>:null}
    <View style={s.section}><Text accessibilityRole="header" style={s.heading}>Verlauf & Zugriffsprotokoll</Text>{detail.audit.map((event,index)=><View key={`${event.created_at}-${index}`} style={s.row}><Text style={s.copy}>{AUDIT_LABELS[event.event]??event.event}</Text><Text style={s.small}>{supportDate(event.created_at)}</Text></View>)}</View>
  </>;
}
