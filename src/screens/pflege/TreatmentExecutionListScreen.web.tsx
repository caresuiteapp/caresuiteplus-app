import {treatmentWorkspaceTarget} from '@/lib/pflege/treatmentWorkspaceNavigation';
import {useEffect,useRef,useState} from 'react';
import {ScrollView,Text} from 'react-native';
import {useRouter} from 'expo-router';
import {ScreenShell} from '@/components/layout';
import {ErrorState,InfoBanner,LoadingState,PremiumButton,PremiumInput,SectionPanel} from '@/components/ui';
import {useAuth} from '@/lib/auth/context';
import {useServiceTenantId} from '@/hooks/useTenantId';
import { useCareRuntimePermissions as usePermissions } from '@/hooks/pflege/useCareRuntimePermissions.web';
import {CarePermissionStatus} from './CarePermissionStatus.web';
import {useAsyncQuery} from '@/hooks/core/useAsyncQuery';
import {ControlSourceLaunchButton} from './ControlSourceLaunchButton.web';
import {StructuredTreatmentSourcePanel} from './StructuredTreatmentSourcePanel.web';
import {woundInstant} from '@/lib/pflege/woundCareDomain';
import {treatmentEventTimeDisplay,treatmentRecordedTimeDisplay} from '@/lib/pflege/treatmentTimeDisplay.web';
import {fetchTreatmentRecords} from '@/lib/pflege/treatmentCorrectionService';
import {TreatmentListEntryGuard,treatmentEntryAccess,captureTreatmentEntryOwner,type TreatmentEntrySelection} from '@/lib/pflege/treatmentListEntryGuard.web';
import {TreatmentCorrectionScreen,TreatmentCorrectionHistory,OriginalTreatmentSection,treatmentOutcome,useTreatmentCorrectionStyles} from './TreatmentCorrectionScreen.web';
export function TreatmentExecutionListScreen(){
 const {profile}=useAuth(),knownOwner=useRef<string>('pending-native-owner');
 const native=captureTreatmentEntryOwner(profile?.tenantId,profile?.id,profile?.roleKey);
 if(native)knownOwner.current=JSON.stringify(native);
 return <TreatmentExecutionListWorkspace key={knownOwner.current}/>;
}
function TreatmentExecutionListWorkspace(){
 const tenant=useServiceTenantId(),{profile}=useAuth(),p=usePermissions(),router=useRouter(),styles=useTreatmentCorrectionStyles();
 const [search,setSearch]=useState(''),[count,setCount]=useState(20),[selected,setSelected]=useState<TreatmentEntrySelection|null>(null);
 const access=treatmentEntryAccess({tenantId:tenant,profileTenantId:profile?.tenantId,profileId:profile?.id,profileRole:profile?.roleKey,runtimeTenantId:p.tenantId,runtimeRole:p.roleKey,canRead:p.can('pflege.treatment.view'),canManage:p.can('pflege.treatment.manage')});
 const guard=useRef(new TreatmentListEntryGuard(access));guard.current.update(access);const lifetime=guard.current.token();
 useEffect(()=>{guard.current.mount();return()=>guard.current.dispose();},[]);
 const q=useAsyncQuery(()=>guard.current.read(lifetime,()=>fetchTreatmentRecords(tenant??'',p.roleKey)),[access.scope],{enabled:access.canRead,queryKey:`${access.scope}:treatment-records-corrections`});
 const view={loading:q.loading,refreshing:q.refreshing,error:q.error,refreshError:q.refreshError,previewData:q.previewData,tableMissing:q.tableMissing,fromCache:q.cacheMeta.fromCache,partialDetail:q.cacheMeta.partialDetail};
 const pool=guard.current.current(q.data,view),readTicket=guard.current.readTicket;
 const latest=useRef({source:q.data,view,selected,search,count,refresh:q.refresh,access,documentation:p.can('pflege.documentation.view'),orders:p.can('pflege.orders.view')});latest.current={source:q.data,view,selected,search,count,refresh:q.refresh,access,documentation:p.can('pflege.documentation.view'),orders:p.can('pflege.orders.view')};
 const refresh=()=>{if(!guard.current.canRead())return;guard.current.invalidate();void latest.current.refresh();};
 const changeSearch=(value:string)=>{if(!guard.current.canRead())return;latest.current.search=value;latest.current.count=20;setSearch(value);setCount(20);};
 const open=(id:string)=>{const current=latest.current;if(current.selected||current.source!==q.data||current.search!==search||current.count!==count)return;const selection=guard.current.open(current.source,current.view,lifetime,id,readTicket);if(!selection)return;latest.current.selected=selection;setSelected(selection);};
 const close=()=>{if(!selected||!guard.current.mayClose(selected,latest.current.selected))return;latest.current.selected=null;setSelected(null);refresh();};
 const records=[...(pool?.executions??[])].sort((a,b)=>{const left=woundInstant(a.performed_at)!,right=woundInstant(b.performed_at)!;return left===right?String(b.id).localeCompare(String(a.id)):left>right?-1:1;});
 const correctionsById=new Map<string,Record<string,unknown>[]>();for(const c of pool?.corrections??[]){const key=String(c.execution_id),items=correctionsById.get(key)??[];items.push(c);correctionsById.set(key,items);}
 const filtered=records.filter(e=>[pool?.clientNames.get(String(e.client_id)),e.title,e.treatment_type,e.recorded_by_name,treatmentOutcome(e.outcome)].join(' ').toLocaleLowerCase('de').includes(search.toLocaleLowerCase('de')));
 if(selected)return <TreatmentCorrectionScreen key={selected.mountKey} executionId={selected.executionId} expectedClientId={selected.clientId} sessionOwner={selected.owner} accessBlocked={!guard.current.owns(selected)} onClose={close}/>;
 if(!guard.current.canRead())return <ScreenShell title="Behandlungspflege"><CarePermissionStatus state={p}/></ScreenShell>;
 return <ScreenShell title="Behandlungspflege und Berichtigungen" subtitle="Durchführungen und vollständige Berichtigungsverläufe zugänglicher aktiver Pflegeakten"><ScrollView contentContainerStyle={styles.content}>
 <PremiumInput label="Klient, Bezeichnung, Behandlungsart, Person oder Ergebnis suchen" accessibilityLabel="Durchführungsnachweise suchen" value={search} onChangeText={changeSearch}/>
 {q.loading&&!pool?<LoadingState message="Durchführungsnachweise und sämtliche Berichtigungsseiten werden geladen…"/>:!pool?<ErrorState message={q.error??'Nachweise nicht vollständig bestätigt. Bitte neu laden.'} onRetry={refresh}/>:null}{q.refreshError?<ErrorState message={`Letzter vollständig geladener Stand: ${q.refreshError}`} onRetry={refresh}/>:null}
 {pool?<><Text style={styles.body}>{records.length} vollständig geladene zugängliche Durchführungsnachweise · {filtered.length} Suchtreffer · dokumentierter Ereigniszeitpunkt absteigend.</Text>{!filtered.length?<InfoBanner variant="info" message={search?'Keine passenden Nachweise im vollständig geladenen zugänglichen Bestand.':'Noch keine zugänglichen Durchführungsnachweise aktiver Pflegeakten vorhanden.'}/>:filtered.slice(0,count).map(e=><SectionPanel key={String(e.id)} title={String(e.title)}><Text style={styles.body}>{pool.clientNames.get(String(e.client_id))} · {typeof e.recorded_by_name==='string'?e.recorded_by_name:'Person nicht bestätigt'}</Text><Text selectable style={styles.body}>Dokumentierter Ereigniszeitpunkt: {treatmentEventTimeDisplay(e.performed_at).display}</Text><Text selectable style={styles.body}>Erfassung des Nachweises: {treatmentRecordedTimeDisplay(e.created_at).display}</Text><Text style={styles.body}>Originalergebnis: {treatmentOutcome(e.outcome)} · Nachweis-ID: {String(e.id)}</Text><OriginalTreatmentSection value={{details:e.details??null,deviation_reason:e.deviation_reason??null,escalation:e.escalation??null,qualification_snapshot:e.qualification_snapshot??null}}/><StructuredTreatmentSourcePanel execution={e}/><ControlSourceLaunchButton clientId={String(e.client_id)} sourceKind="treatment_execution" sourceId={String(e.id)} disabled={q.loading||q.refreshing||!!q.refreshError||(correctionsById.get(String(e.id))??[]).length>0}/><TreatmentCorrectionHistory key={`${tenant}:${profile?.id}:${p.roleKey}:${String(e.id)}`} corrections={correctionsById.get(String(e.id))??[]} execution={e}/>{access.canManage?<PremiumButton title="Diesen Originalnachweis begründet berichtigen" variant="secondary" disabled={!pool} onPress={()=>open(String(e.id))}/>:null}</SectionPanel>)}{filtered.length>count?<PremiumButton title="Weitere Durchführungsnachweise anzeigen" variant="secondary" onPress={()=>{if(guard.current.current(latest.current.source,latest.current.view)){latest.current.count+=20;setCount(latest.current.count);}}}/>:null}</>:null}
 {p.can('pflege.documentation.view')?<PremiumButton title="Trink-, Mahlzeiten- und Ausscheidungsprotokolle öffnen" variant="secondary" onPress={()=>{if(guard.current.canRead()&&latest.current.documentation)router.push(treatmentWorkspaceTarget('protocols') as never);}}/>:null}
 {p.can('pflege.documentation.view')&&p.can('pflege.orders.view')?<PremiumButton title="Kontrollaufträge und Eskalationen öffnen" variant="secondary" onPress={()=>{if(guard.current.canRead()&&latest.current.documentation&&latest.current.orders)router.push(treatmentWorkspaceTarget('controls') as never);}}/>:null}
 {p.can('pflege.orders.view')?<PremiumButton title="Verordnung, Durchführung und Abschluss gemeinsam bearbeiten" variant="secondary" onPress={()=>{if(guard.current.canRead()&&latest.current.orders)router.push(treatmentWorkspaceTarget('care-packet') as never);}}/>:null}
 <PremiumButton title="Nachweise und Berichtigungen aktualisieren" variant="secondary" onPress={refresh}/>{p.can('pflege.orders.view')?<PremiumButton title="Infusions- und Pumpenverläufe öffnen" variant="secondary" onPress={()=>{if(guard.current.canRead()&&latest.current.orders)router.push(treatmentWorkspaceTarget('infusions') as never);}}/>:null}{access.canManage?<PremiumButton title="Neue tatsächliche Durchführung dokumentieren" onPress={()=>{if(latest.current.access.canManage&&guard.current.canRead())router.push('/pflege/behandlungspflege/new' as never);}}/>:null}
 </ScrollView></ScreenShell>;
}
