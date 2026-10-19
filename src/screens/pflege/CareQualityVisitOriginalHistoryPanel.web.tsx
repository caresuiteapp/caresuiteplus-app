import {useEffect,useMemo,useRef,useState} from 'react';
import {StyleSheet,Text,View} from 'react-native';
import {EmptyState,ErrorState,LoadingState,PremiumButton,PremiumCard,SectionPanel} from '@/components/ui';
import {useCareLightPalette} from '@/design/tokens/carelightadaptive';
import {careSpacing} from '@/design/tokens/spacing';
import {useCareQualityVisitOriginalHistory} from '@/hooks/pflege/useCareQualityVisitOriginalHistory.web';
import type {CareQualityVisitHistoryProjectionWeb} from '@/hooks/pflege/useCareQualityVisitOriginalHistory.web';
import {currentCareQualityVisitParentSelectionWeb} from './PflegeDedicatedScreens.web';

type History=CareQualityVisitHistoryProjectionWeb;
type Field=History['current']['scope'];
type Time=History['current']['scheduled'];
type Visit=History['current'];
function fieldText(field:Field|null):string{
 if(!field)return 'Nicht geliefert';
 return field.state==='value'?field.value!:field.state==='missing'||field.state==='undefined'?'Nicht geliefert':field.state==='null'?'Kein Wert gespeichert':field.state==='empty'?'Leer gespeichert':'Originalformat ungeklärt';
}
function originalTimeText(value:Time|null):string{
 if(!value)return 'Nicht geliefert';
 return value.state==='valid'?value.display!:value.state==='missing'||value.state==='undefined'?'Nicht geliefert':value.state==='null'?'Keine Zeit gespeichert':value.state==='empty'?'Leer gespeichert':value.raw===null?'Originalformat ungeklärt':'Originalformat ungeklärt · Original: '+value.raw;
}
function VisitMetadata({value,mayRead}:{value:Visit;mayRead:()=>boolean}){
 const {c}=useCareLightPalette(),styles=useMemo(()=>createStyles(c),[c]);
 if(!mayRead())return null;
 return <View style={styles.section}>
  <Text selectable style={styles.note}>Visiten-ID: {value.id}</Text><Text style={styles.body}>Gespeicherter Prüfumfang: {fieldText(value.scope)}</Text>
  <Text style={styles.body}>Statusangabe im Original: {fieldText(value.storedStatus)} · Typangabe: {fieldText(value.visitType)}</Text>
  <Text selectable style={styles.body}>Besuchenden-ID: {fieldText(value.visitorId)}</Text><Text style={styles.body}>Gespeicherter Besuchendenname: {fieldText(value.visitorName)}</Text>
  <Text style={styles.note}>Kennung und Namensangabe bestätigen keine geprüfte Personenidentität.</Text>
  <Text style={styles.body}>Gespeicherte Feststellungen: {fieldText(value.findings)}</Text><Text style={styles.body}>Gespeicherte Abweichungen: {fieldText(value.deviations)}</Text>
  <Text style={styles.body}>Gespeicherte Vereinbarungsangabe (Freitext): {fieldText(value.agreedActions)}</Text><Text style={styles.body}>Gespeicherte Rückmeldung der Person: {fieldText(value.personFeedback)}</Text>
  <Text selectable style={styles.body}>Plantermin: {originalTimeText(value.scheduled)}</Text><Text selectable style={styles.body}>Gespeicherter Ereigniszeitpunkt: {originalTimeText(value.event)}</Text>
  <Text selectable style={styles.body}>Nächster gespeicherter Zeitverweis: {originalTimeText(value.nextVisit)}</Text><Text style={styles.note}>Der Zeitverweis bestätigt keine Vereinbarung.</Text>
  <Text selectable style={styles.note}>Erfassung: {originalTimeText(value.recorded)}</Text><Text selectable style={styles.note}>Änderung: {originalTimeText(value.updated)}</Text>
 </View>;
}
function snapshotText(state:History['audits'][number]['before']['state']):string{
 return state==='supplied_matching_snapshot'?'Gelieferter zugeordneter Snapshot':state==='missing'?'Snapshot nicht geliefert':state==='null'?'Kein Snapshot gespeichert':state==='opaque_legacy'?'Früheres Originalformat nicht als Visitensnapshot zuordenbar':state==='snapshot_mismatch'?'Snapshotkennung stimmt nicht mit dem Auditbezug überein':'Nativer Entitybezug ungeklärt';
}
/** Primitive historical display only; raw pools, credentials and actual native receipts never become props. */
export function CareQualityVisitOriginalHistoryPanel({captureSelection}:{captureSelection:unknown}){
 const read=useCareQualityVisitOriginalHistory(captureSelection),{c}=useCareLightPalette(),styles=useMemo(()=>createStyles(c),[c]);
 const alive=useRef(false),latest=useRef({captureSelection,read});latest.current={captureSelection,read};
 const [display,setDisplay]=useState<{factory:unknown;limit:number;expanded:readonly string[]}>({factory:captureSelection,limit:20,expanded:[]});
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useEffect(()=>{setDisplay({factory:captureSelection,limit:20,expanded:[]});},[captureSelection]);
 const projection=read.view(),state=display.factory===captureSelection?display:{factory:captureSelection,limit:20,expanded:[]};
 const active=()=>alive.current&&!!projection&&latest.current.captureSelection===captureSelection&&read.view()===projection&&latest.current.read.view()===projection;
 const more=()=>{if(active())setDisplay(previous=>active()&&previous.factory===captureSelection?{...previous,limit:previous.limit+20}:previous);};
 const toggle=(id:string)=>{
  if(!active()||!projection!.audits.some(a=>a.id===id))return;
  setDisplay(previous=>active()&&previous.factory===captureSelection?{...previous,expanded:previous.expanded.includes(id)?previous.expanded.filter(key=>key!==id):[...previous.expanded,id]}:previous);
 };
 const retry=async()=>{if(!alive.current||latest.current.captureSelection!==captureSelection||!currentCareQualityVisitParentSelectionWeb(captureSelection))return;await read.refresh();};
 const plan=projection?.currentPlan;
 if(!read.available)return <SectionPanel title="Visite · Originalhistorie"><EmptyState title="Originalhistorie nicht freigegeben" message="Eine aktuelle eigene Visitenauswahl sowie Leserechte für Visiten, Pläne, Audit und sensible Klientendaten sind erforderlich."/></SectionPanel>;
 if(read.loading||read.refreshing)return <SectionPanel title="Visite · Originalhistorie"><LoadingState message="Die eigenen Originalbelege werden gelesen…"/></SectionPanel>;
 if(!projection||!active())return <SectionPanel title="Visite · Originalhistorie"><ErrorState message={read.error??'Die eigene Originalhistorie ist nicht aktuell bestätigt. Bei erneuerter Liste wählen Sie die Visite ausdrücklich erneut aus.'} onRetry={()=>{void retry();}}/></SectionPanel>;
 return <SectionPanel title="Visite · Originalhistorie" subtitle="Aktuell gelieferte Zeile und gespeicherte Audit-Snapshots bleiben getrennt."><View style={styles.section}>
  <Text style={styles.note}>Die drei abgefragten Bestände sind kein atomarer Datenstand und kein vollständiges Versionsregister. Status, Datum, Auditaktion oder Vereinbarungsfreitext bestätigen keine Durchführung, Aufgabe oder fachliche Freigabe.</Text>
  <PremiumCard><Text style={styles.heading}>Aktuell gelieferte Visitzeile</Text><VisitMetadata value={projection.current} mayRead={()=>active()}/></PremiumCard>
  <PremiumCard><View style={styles.section}><Text style={styles.heading}>Aktuell gespeicherter Planbezug</Text><Text selectable style={styles.body}>Plan-ID: {plan!.id??'Kein Planbezug gespeichert'}</Text><Text style={styles.body}>{plan!.relation==='supplied_current_plan'?'Aktuelle Planzeile geliefert':plan!.relation==='no_plan'?'Kein Planbezug im Original':'Planzeile nicht geliefert'}</Text>
   <Text style={styles.body}>Gespeicherter Titel: {fieldText(plan!.title)}</Text><Text style={styles.body}>Statusangabe: {fieldText(plan!.storedStatus)}</Text><Text selectable style={styles.note}>Gespeicherter Kalenderbezug: {fieldText(plan!.validFrom)} bis {fieldText(plan!.validUntil)}</Text>
   <Text selectable style={styles.note}>Erfassung: {originalTimeText(plan!.recorded)}</Text><Text selectable style={styles.note}>Änderung: {originalTimeText(plan!.updated)}</Text><Text style={styles.note}>Der aktuelle Planbezug bestätigt weder einen zum Auditzeitpunkt gültigen Plan noch eine aktive Pflegezuordnung.</Text>
  </View></PremiumCard>
  <Text style={styles.heading}>Tatsächlich zugehörige Auditbelege</Text><Text style={styles.note}>Die Reihenfolge der Kennungen ist eine Ladeordnung, keine klinische Zeitfolge.</Text>
  {projection.audits.length===0?<Text style={styles.body}>Im gelieferten Bestand ist kein Auditbeleg mit dieser Visitkennung enthalten. Eine vollständige leere Historie ist damit nicht bestätigt.</Text>:projection.audits.slice(0,state.limit).map(audit=><AuditMetadata key={audit.id} audit={audit} expanded={state.expanded.includes(audit.id)} mayRead={()=>active()&&projection.audits.includes(audit)} onToggle={()=>toggle(audit.id)}/>)}
  {projection.audits.length>state.limit?<PremiumButton title="Weitere zugehörige Auditbelege" variant="ghost" onPress={more}/>:null}
  {projection.unresolvedAuditReferences.length?<Text selectable style={styles.note}>Weitere ungeklärte Auditbezüge im Klientenbestand: {projection.unresolvedAuditReferences.map(a=>a.id+' · '+(a.entityId??'Keine Entitykennung')+' · '+(a.reason==='no_native_entity'?'Kein nativer Visitbezug':'Visitzeile nicht geliefert')).join('\n')}</Text>:null}
 </View></SectionPanel>;
}
function AuditMetadata({audit,expanded,mayRead,onToggle}:{audit:History['audits'][number];expanded:boolean;mayRead:()=>boolean;onToggle:()=>void}){
 const {c}=useCareLightPalette(),styles=useMemo(()=>createStyles(c),[c]);if(!mayRead())return null;
 return <PremiumCard><View style={styles.section}><Text selectable style={styles.heading}>Audit-ID: {audit.id}</Text><Text selectable style={styles.note}>Nativer Visitbezug: {audit.entityId}</Text><Text style={styles.body}>Gespeicherte Aktion: {fieldText(audit.action)}</Text><Text style={styles.body}>Gespeicherte Zusammenfassung: {fieldText(audit.summary)}</Text><Text selectable style={styles.body}>Actor-ID: {fieldText(audit.actorId)}</Text><Text style={styles.body}>Gespeicherter Actorname: {fieldText(audit.actorName)}</Text><Text selectable style={styles.note}>Auditerfassung: {originalTimeText(audit.recorded)}</Text>
  <PremiumButton title={expanded?'Snapshotangaben schließen':'Snapshotangaben ansehen'} variant="ghost" onPress={()=>{if(mayRead())onToggle();}}/>
  {expanded?<View style={styles.section}>{(['before','after'] as const).map(key=><View key={key} style={styles.section}><Text style={styles.heading}>{key==='before'?'Gespeicherte Vorherangabe':'Gespeicherte Nachherangabe'}</Text><Text style={styles.note}>{snapshotText(audit[key].state)}</Text>{audit[key].value?<VisitMetadata value={audit[key].value} mayRead={mayRead}/>:null}</View>)}</View>:null}
 </View></PremiumCard>;
}
function createStyles(c:ReturnType<typeof useCareLightPalette>['c']){return StyleSheet.create({section:{gap:careSpacing.sm,minWidth:0,maxWidth:'100%'},heading:{fontSize:17,fontWeight:'800',color:c.text,flexShrink:1,maxWidth:'100%'},body:{fontSize:15,lineHeight:22,color:c.text,flexShrink:1,maxWidth:'100%'},note:{fontSize:13,lineHeight:20,color:c.muted,flexShrink:1,maxWidth:'100%'}});}
