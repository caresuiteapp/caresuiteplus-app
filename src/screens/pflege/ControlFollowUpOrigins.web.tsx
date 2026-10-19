import {Text,View} from 'react-native';
import {InfoBanner,PremiumButton,SectionPanel} from '@/components/ui';
import { useCareRuntimePermissions as usePermissions } from '@/hooks/pflege/useCareRuntimePermissions.web';
import {colors,spacing,typography} from '@/theme';
import {controlFollowUpComparisonLabels,type controlFollowUpReferences} from '@/lib/pflege/clinicalControlFollowUps';
import {controlSourceLabels,controlTaskStatusLabel} from '@/lib/pflege/clinicalControlForm';
type Incoming=ReturnType<typeof controlFollowUpReferences>['incoming'][number];
const body={...typography.body,color:colors.textSecondary};
/** An explicit incoming reference describes an original event, not the cause of this task. */
export function ControlFollowUpOrigins({incoming,disabled,onOpen}:{incoming:Incoming;disabled:boolean;onOpen:(incoming:Incoming)=>void}){
 const p=usePermissions(),{relation,origin,event,originState}=incoming,d=event.draft;
 const allowed=p.can('pflege.documentation.view')&&p.can('pflege.treatment.view')&&p.can('pflege.orders.view');
 if(d.kind!=='resolve')return null;
 return <SectionPanel title={originState.title}>
  <InfoBanner variant={relation.comparison==='open_at_recording'?'info':'warning'} message={controlFollowUpComparisonLabels[relation.comparison]}/>
  <View style={{gap:spacing.xs}}>
   <Text style={body}>Verweisender Ursprungsauftrag: {origin.task.id}{'\n'}Originalabschluss: {event.id}{'\n'}Ausdrücklich benannter Zielauftrag: {relation.targetTaskId}</Text>
   <Text style={body}>{relation.currentCycle?'Originalabschluss aus der aktuellen Ursprungsauftragsfassung':'Originalabschluss aus einer früheren Ursprungsauftragsfassung'}{'\n'}Damals dokumentiertes Ergebnis: {controlTaskStatusLabel(originState.source.kind,d.outcome)}{'\n'}Tatsächlicher Originalabschluss: {d.occurredAt}{'\n'}Originalabschluss erfasst: {event.recordedAt}{'\n'}Dokumentiert von: {origin.actorNames[event.id]} · Originalkennung {event.actorId}</Text>
   <Text style={body}>Originalgrund: {d.reason}{'\n'}Originalresultat: {d.result}{'\n'}Abstimmung: {d.communication}{'\n'}Personenentscheidung: {d.personDecision}</Text>
   <Text style={body}>Heutiger vollständig geladener Ursprungsauftrag: {controlTaskStatusLabel(originState.source.kind,originState.status)}{'\n'}Aktueller Originalkopf: {origin.headId} · Fassung {origin.eventCount}{'\n'}Aktuelle Aufgabenfrist: {originState.policy.dueAt}{originState.overdue?' · Erreicht/überschritten':''}{'\n'}Ursprüngliche Quelle: {controlSourceLabels[originState.source.kind]} · {originState.source.id}</Text>
   {relation.recordedPrefix?<Text style={body}>Dokumentierter Zielverlauf bis zur damaligen Abschluss-Erfassung: Kopf {relation.recordedPrefix.headId} · Fassung {relation.recordedPrefix.sequence}. Dieser Ausschnitt belegt keinen damals gleichzeitig gültigen oder gesicherten Auftragsschreibstand.</Text>:null}
   {relation.sameTimeEventIds.length?<Text style={body}>Zeitgleich erfasste Zielereignisse: {relation.sameTimeEventIds.join(', ')}. Die Reihenfolge zwischen den Aufträgen bleibt unklar.</Text>:null}
   <Text style={body}>Dieser ausdrückliche Verweis beweist keine Ursache der Auftragserstellung, keine Durchführung des Zielauftrags und keine Freigabe. Ursprungsauftrag und Zielauftrag können verschiedene Quellen oder Assessments betreffen.</Text>
  </View>
  {allowed?<PremiumButton title="Verweisenden Originalauftrag mit vollständigem Verlauf öffnen" variant="secondary" disabled={disabled} onPress={()=>{if(!disabled)onOpen(incoming);}}/>:null}
 </SectionPanel>;
}
