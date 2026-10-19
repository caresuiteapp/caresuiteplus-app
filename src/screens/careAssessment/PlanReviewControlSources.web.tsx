import {useState} from 'react';
import {Text,View} from 'react-native';
import {PremiumButton,SectionPanel} from '@/components/ui';
import {colors,spacing,typography} from '@/theme';
import type {ReviewControlLink,ReviewMeasureControl} from '@/lib/careAssessment/planReviewControls';
import type {PlanReviewControlSourceComparison} from '@/lib/careAssessment/planReviewControlSources';
import {ControlSourceComparisonDetails} from '../pflege/ControlSourceDetails.web';
import {controlTaskStatusLabel} from '@/lib/pflege/clinicalControlForm';
const body={...typography.body,color:colors.textSecondary};
function TaskSources({comparison}:{comparison:PlanReviewControlSourceComparison}){
 const [count,setCount]=useState(5),record=comparison.record;
 return <SectionPanel title={`Getrennter Quellenvergleich · ${comparison.state.title}`}>
  <Text style={body}>Nativer Originalauftrag: {record.task.id}{'\n'}Gesicherter Verlaufskopf: {record.headId}{'\n'}Unabhängiger Aufgabenstatus: {controlTaskStatusLabel(comparison.state.source.kind,comparison.state.status)}</Text>
  <Text style={body}>Ursprünglicher Auftragsbeleg</Text><ControlSourceComparisonDetails comparison={comparison.originComparison}/>
  {!comparison.results.length?<Text style={body}>Keine tatsächlichen Teilprüfungs- oder Ergebnisereignisse dokumentiert.</Text>:<Text style={body}>{comparison.results.length} Ergebnisbezüge aus dem vollständigen Originalverlauf; frühere Auftragsfassungen bleiben enthalten.</Text>}
  {comparison.results.slice(0,count).map(result=>{const event=result.event;return <View key={event.id} style={{gap:spacing.sm}}>
   <Text style={body}>Originalergebnis {event.sequence} · native Ereigniskennung {event.id}{'\n'}{result.currentCycle?'Ergebnis der aktuellen Auftragsfassung':'Historisches Ergebnis einer früheren Auftragsfassung; kein Abschluss der jetzigen Fassung'}{'\n'}Tatsächlicher Originalereigniszeitpunkt: {event.draft.occurredAt}{'\n'}Tatsächliche Originalerfassung: {event.recordedAt}{'\n'}Gesicherter historischer Personenname: {record.actorNames[event.id]}{'\n'}Ursprüngliche Personenkennung: {event.actorId}</Text>
   <ControlSourceComparisonDetails comparison={result.sourceComparison}/>
  </View>;})}
  {count<comparison.results.length?<PremiumButton title="Weitere historische Ergebnisquellen vergleichen" variant="secondary" onPress={()=>setCount(value=>value+5)}/>:null}
  <Text style={body}>Die Quellenfassungen sind hier getrennt lesbar. Genaue Auftragsergebnisse und vollständige Historien sind über „Diesen bestehenden Auftrag mit vollständigem Verlauf öffnen“ im zugehörigen Auftrag erreichbar. Der Quellenvergleich ändert diese Originale nicht.</Text>
 </SectionPanel>;
}
export function PlanReviewControlSources({links,comparisons}:{links:(ReviewControlLink|ReviewMeasureControl)[];comparisons:PlanReviewControlSourceComparison[]}){
 const [count,setCount]=useState(5),ids=new Set(links.map(link=>link.record.task.id)),selected=comparisons.filter(row=>ids.has(row.record.task.id));
 return <View style={{gap:spacing.md}}>{selected.slice(0,count).map(row=><TaskSources key={row.record.task.id+':'+row.record.headId} comparison={row}/>)}{count<selected.length?<PremiumButton title="Weitere zugeordnete Originalquellen vergleichen" variant="secondary" onPress={()=>setCount(value=>value+5)}/>:null}</View>;
}
