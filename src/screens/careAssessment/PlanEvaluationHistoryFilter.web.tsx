import {useState} from 'react';
import {Text} from 'react-native';
import {colors,typography} from '@/theme';
import {FilterChipGroup,InfoBanner,PremiumButton,PremiumInput,SectionPanel} from '@/components/ui';
import {evaluationNames} from '@/lib/careAssessment/planEvaluationLabels';
import {emptyEvaluationTimelineFilter,evaluationTimelineOutcomes,type EvaluationTimelineFilter} from '@/lib/careAssessment/planEvaluationTimeline';
const body={...typography.body,color:colors.textSecondary};
export function EvaluationHistoryFilter({filter,measures,onChange}:{filter:EvaluationTimelineFilter;measures:{id:string;title:string}[];onChange:(f:EvaluationTimelineFilter)=>void}){
 const [measureQuery,setMeasureQuery]=useState(''),[measureCount,setMeasureCount]=useState(20);
 const matches=measures.filter(m=>`${m.title} ${m.id}`.toLocaleLowerCase('de').includes(measureQuery.trim().toLocaleLowerCase('de')));
 const shown=matches.slice(0,measureCount),selected=measures.find(m=>m.id===filter.measureId);
 if(selected&&!shown.some(m=>m.id===selected.id))shown.unshift(selected);
 const change=(key:keyof EvaluationTimelineFilter,value:string)=>onChange({...filter,[key]:value});
 return <SectionPanel title="Evaluationsverlauf gezielt prüfen">
  <PremiumInput label="Im aktuellen Befund und Originalplan suchen" accessibilityLabel="Im aktuellen Befund und Originalplan suchen" value={filter.query} onChangeText={v=>change('query',v)}/>
  <Text style={body}>Originalmaßnahme auswählen. Ergebnis- und Herkunftsfilter beziehen sich dann ausschließlich auf deren Einzelbewertung.</Text>
  <PremiumInput label="Originalmaßnahme nach Titel oder ID finden" value={measureQuery} onChangeText={v=>{setMeasureQuery(v);setMeasureCount(20);}}/>
  <FilterChipGroup wrap options={[{key:'',label:'Gesamte Evaluation'},...shown.map(m=>({key:m.id,label:`${m.title} · ${m.id}`}))]} value={filter.measureId} onChange={v=>onChange({...filter,measureId:v,outcome:'all',source:'all'})}/>
  {matches.length>measureCount?<PremiumButton title="Weitere Originalmaßnahmen anzeigen" variant="secondary" onPress={()=>setMeasureCount(n=>n+20)}/>:null}
  {!matches.length?<Text style={body}>Keine Originalmaßnahme entspricht der Suche.</Text>:null}
  {filter.state!=='withdrawn'?<><Text style={body}>Ergebnis</Text><FilterChipGroup wrap options={evaluationTimelineOutcomes.filter(k=>!!filter.measureId||k!=='no_individual_result').map(k=>({key:k,label:k==='all'?'Alle Ergebnisse':k==='no_individual_result'?'Keine Einzelbewertung vorhanden':evaluationNames[k]}))} value={filter.outcome} onChange={v=>change('outcome',v)}/>
  <Text style={body}>Befundherkunft</Text><FilterChipGroup wrap options={['all','observed','reported',...(filter.measureId?['no_individual_result']:[])].map(k=>({key:k,label:k==='all'?'Alle Herkünfte':k==='no_individual_result'?'Keine Einzelbewertung vorhanden':evaluationNames[k]}))} value={filter.source} onChange={v=>change('source',v)}/></>:null}
  <Text style={body}>Fassung</Text><FilterChipGroup wrap options={[{key:'current',label:'Aktuelle Evaluationen'},{key:'withdrawn',label:'Zurückgenommene Originale'},{key:'all',label:'Alle Originale'}]} value={filter.state} onChange={v=>onChange({...filter,state:v as EvaluationTimelineFilter['state'],outcome:'all',source:'all',fromAt:'',throughAt:''})}/>
  {filter.state!=='withdrawn'?<><PremiumInput label="Evaluation frühestens mit Zeitzone" value={filter.fromAt} onChangeText={v=>change('fromAt',v)}/><PremiumInput label="Evaluation spätestens mit Zeitzone" value={filter.throughAt} onChangeText={v=>change('throughAt',v)}/></>:null}
  <InfoBanner variant="info" message="Der Zeitraum betrifft die tatsächliche Evaluation, nicht ihre spätere Erfassung. Die Suche berücksichtigt die aktuelle Fassung. Frühere Berichtigungsfassungen bleiben im jeweiligen Originalverlauf erreichbar. Zurückgenommene Originale haben kein aktuelles Ergebnis und fallen bei Ergebnis-, Herkunfts- oder Zeitfiltern heraus."/>
  <PremiumButton title="Filter zurücksetzen" variant="secondary" onPress={()=>{setMeasureQuery('');setMeasureCount(20);onChange(emptyEvaluationTimelineFilter());}}/>
 </SectionPanel>;
}
