import {useEffect,useState} from 'react';
import {StyleSheet,Text,View} from 'react-native';
import {DetailInfoRow} from '@/components/detail';
import {EmptyState,ErrorState,InfoBanner,LoadingState,PremiumButton,SectionPanel} from '@/components/ui';
import {useCareLightPalette} from '@/design/tokens/carelightadaptive';
import {spacing,typography} from '@/theme';
import {mountMentalHealthNarrativePanelWeb,disposeMentalHealthNarrativePanelWeb,subscribeMentalHealthNarrativePanelWeb,mentalHealthNarrativePanelViewWeb,
 readMentalHealthNarrativePanelWeb,selectMentalHealthNarrativePanelWeb,expandMentalHealthNarrativePanelWeb,moreMentalHealthNarrativePanelWeb,
 type MentalHealthNarrativePanelToken,type MentalHealthNarrativePanelLifetime} from '@/lib/careAssessment/mentalHealthNarrativePanelBinding.web';
import type {MentalHistoryField,MentalHistoryTime} from '@/lib/careAssessment/mentalHealthNarrativeHistory.web';

type Props={token:MentalHealthNarrativePanelToken};
const labels:Record<string,string>={person_perspective:'Gespeicherte Perspektive der Person',resources:'Ressourcen und Fähigkeiten',wishes:'Wünsche',habits_biography:'Gewohnheiten und Biografie',title:'Maßnahmentitel',personal_goal:'Individuelles Ziel',intervention:'Geplante Unterstützung',timing:'Geplanter Zeitpunkt',frequency:'Geplante Häufigkeit',person_contribution:'Beitrag der Person',relatives_contribution:'Beitrag der An- und Zugehörigen',related_topic_key:'Gespeicherter Themenbezug (Text)',related_risk_key:'Gespeicherter Risikobezug (Text)'};
function fieldText(field:MentalHistoryField):string{
 if(field.state==='missing')return'Nicht im gelieferten Bestand enthalten';if(field.state==='null')return'Kein Wert hinterlegt';if(field.state==='empty')return'Leer hinterlegt';
 if(field.state!=='value')return'Angabe nicht bestätigt';return typeof field.value==='boolean'?(field.value?'Ja':'Nein'):String(field.value);
}
function TimeRow({label,time}:{label:string;time:MentalHistoryTime}){
 const {c}=useCareLightPalette();return <View style={staticStyles.time}><DetailInfoRow label={label} value={time.display}/>{time.raw!==null?<Text selectable style={[staticStyles.rawTime,{color:c.muted}]}>Gelieferte Zeit: {time.raw}</Text>:null}</View>;
}
/** Private unbound source review. Additional Sensitive permission is not a psychiatric need-to-know or product release. */
export function MentalHealthNarrativeSourcePanel({token}:Props){
 const {c}=useCareLightPalette();const [lifetime,setLifetime]=useState<MentalHealthNarrativePanelLifetime|null>(null),[,invalidate]=useState(0),[contentWidth,setContentWidth]=useState(0);
 useEffect(()=>{
  const current=mountMentalHealthNarrativePanelWeb(token);setLifetime(current);if(!current)return;
  const unsubscribe=subscribeMentalHealthNarrativePanelWeb(token,current,()=>invalidate(value=>value+1));
  const timer=setInterval(()=>invalidate(value=>value+1),1000);
  return()=>{clearInterval(timer);unsubscribe();disposeMentalHealthNarrativePanelWeb(token,current);};
 },[token]);
 const view=lifetime?mentalHealthNarrativePanelViewWeb(token,lifetime):null;
 const read=()=>{if(lifetime&&view)void readMentalHealthNarrativePanelWeb(token,lifetime,view);};
 const select=(kind:'topic'|'measure',id:string)=>{if(lifetime&&view)selectMentalHealthNarrativePanelWeb(token,lifetime,view,kind,id);};
 const expand=()=>{if(lifetime&&view)expandMentalHealthNarrativePanelWeb(token,lifetime,view);};
 const more=(kind:'topic'|'measure')=>{if(lifetime&&view)moreMentalHealthNarrativePanelWeb(token,lifetime,view,kind);};
 const styles=StyleSheet.create({root:{gap:spacing.md,minWidth:0},columns:{gap:spacing.md,minWidth:0},wide:{flexDirection:'row',alignItems:'flex-start'},column:{flex:1,minWidth:0,gap:spacing.sm},
  row:{gap:spacing.xs,minWidth:0,paddingVertical:spacing.sm,borderBottomWidth:1,borderBottomColor:c.border},body:{...typography.body,color:c.text,flexShrink:1},muted:{...typography.caption,color:c.muted,flexShrink:1},actions:{flexDirection:'row',flexWrap:'wrap',gap:spacing.sm,minWidth:0}});
 const topic=view?.selectedTopic,measure=view?.selectedMeasure;
 return <View style={styles.root} onLayout={layout=>setContentWidth(Math.max(0,layout.nativeEvent.layout.width))}>
  <SectionPanel title="Gespeicherte Perspektiven und Unterstützung" subtitle="Quellenangaben und Planung getrennt prüfen">
   <InfoBanner presentation="inline" variant="info" message="Die gelieferten Angaben beschreiben gespeicherte Aussagen und Planung. Daraus folgt keine Diagnose, tatsächliche Durchführung, Teilnahme oder klinische Freigabe. Krisen- und Risikodetails gehören nicht zu dieser begrenzten Quellenansicht."/>
   {!view?<LoadingState presentation="inline" message="Eigener vertraulicher Lesebezug wird geprüft…"/>:null}
   {view?.stage==='blocked'?<ErrorState presentation="inline" message="Der aktuelle eigene Plan- und Sensitivzugriff ist nicht bestätigt. Den Bereich mit einem neuen eigenen Lesebezug erneut öffnen."/>:null}
   {view?.stage==='loading'?<LoadingState presentation="inline" message="Ganzer eigener Originalbestand wird geladen…"/>:null}
   {view?.stage==='error'?<ErrorState presentation="inline" message="Der gesamte eigene Bestand ist ungeklärt. Es wird kein älterer Teilbestand angezeigt." onRetry={view.canRead?read:undefined}/>:null}
   {view?.stage==='idle'?<PremiumButton title="Eigenen Quellenbestand laden" variant="secondary" disabled={!view.canRead} onPress={read}/>:null}
   {view?.stage==='ready'?<View style={styles.actions}><PremiumButton title="Gesamten Bestand erneut laden" variant="secondary" onPress={read}/></View>:null}
   {view?.stage==='ready'?<Text selectable style={styles.muted}>Assessmentkennung: {view.assessmentId}</Text>:null}
  </SectionPanel>
  {view?.stage==='ready'?<View style={[styles.columns,contentWidth>=880&&styles.wide]}>
   <View style={styles.column}><SectionPanel title={`Themenquellen (${view.topicCount})`}>
    {!view.topicCount?<EmptyState title="Gelieferte Themenquellen leer" message="Keine Themenzeilen im eigenen Lesestand. Daraus folgt keine Bewertung von Fähigkeiten oder Bedürfnissen."/>:null}
    {view.topicRows.map(row=><View key={row.id} style={styles.row}><DetailInfoRow label="Gespeicherter Themenschlüssel" value={fieldText(row.topicKey)}/><TimeRow label="Erfasst" time={row.recordedAt}/><Text selectable style={styles.muted}>Themenkennung: {row.id}</Text><PremiumButton title={topic?.id===row.id?'Ausgewählte Themenquelle':'Themenquelle auswählen'} variant="secondary" onPress={()=>select('topic',row.id)}/></View>)}
    {view.topicRemaining>0?<PremiumButton title={`Weitere Themenquellen (${view.topicRemaining})`} variant="secondary" onPress={()=>more('topic')}/>:null}
   </SectionPanel></View>
   <View style={styles.column}><SectionPanel title={`Gespeicherte Maßnahmenplanung (${view.measureCount})`}>
    {!view.measureCount?<EmptyState title="Gelieferte Planung leer" message="Keine Maßnahmenzeilen im eigenen Lesestand. Keine bestätigte Durchführung oder Teilnahme."/>:null}
    {view.measureRows.map(row=><View key={row.id} style={styles.row}><Text selectable style={styles.body}>{fieldText(row.title)}</Text><TimeRow label="Erfasst" time={row.recordedAt}/><Text selectable style={styles.muted}>Maßnahmenkennung: {row.id}</Text><PremiumButton title={measure?.id===row.id?'Ausgewählte Planung':'Planangaben auswählen'} variant="secondary" onPress={()=>select('measure',row.id)}/></View>)}
    {view.measureRemaining>0?<PremiumButton title={`Weitere Planangaben (${view.measureRemaining})`} variant="secondary" onPress={()=>more('measure')}/>:null}
   </SectionPanel></View>
  </View>:null}
  {topic?<SectionPanel title="Ausgewählte Themenquelle">
   <TimeRow label="Erfasst" time={topic.recordedAt}/><TimeRow label="Änderungsstand der gelieferten Zeile" time={topic.updatedAt}/>
   <PremiumButton title={view?.expanded?'Quellenangaben schließen':'Perspektive und Quellenangaben anzeigen'} variant="secondary" onPress={expand}/>
   {view?.expanded?<View style={styles.root}>
    {Object.entries(topic.fields).map(([key,value])=><DetailInfoRow key={key} label={labels[key]} value={fieldText(value)}/>)}
    <DetailInfoRow label="Gespeicherte Informationsquellen" value={topic.informationSources.state==='value'?topic.informationSources.values?.join(' · ')??'Angabe nicht bestätigt':fieldText({state:topic.informationSources.state})}/>
    {view.communicationSupport?<DetailInfoRow label="Gespeicherte Kommunikationshilfe" value={fieldText(view.communicationSupport)}/>:null}
   </View>:null}
  </SectionPanel>:null}
  {measure?<SectionPanel title="Ausgewählte gespeicherte Planung">
   <TimeRow label="Erfasst" time={measure.recordedAt}/><TimeRow label="Änderungsstand der gelieferten Zeile" time={measure.updatedAt}/><TimeRow label="Gespeicherte Kontrollvereinbarung · keine bestätigte Kontrolle" time={measure.reviewAgreement}/>
   <PremiumButton title={view?.expanded?'Planangaben schließen':'Gespeicherte Planangaben anzeigen'} variant="secondary" onPress={expand}/>
   {view?.expanded?<View style={styles.root}>{Object.entries(measure.fields).map(([key,value])=><DetailInfoRow key={key} label={labels[key]} value={fieldText(value)}/>)}<InfoBanner presentation="inline" variant="info" message="Gespeicherte Themen- und Risikoschlüssel sind Textbezüge. Sie bestätigen keine geprüfte Fremdreferenz, erfolgte Intervention oder Krisenfreigabe."/></View>:null}
  </SectionPanel>:null}
 </View>;
}
const staticStyles=StyleSheet.create({time:{gap:spacing.xs,minWidth:0},rawTime:{...typography.caption,flexShrink:1}});
