import {colors,typography,spacing} from '@/theme';
import {Text,View} from 'react-native';
import {FilterChipGroup,InfoBanner,PremiumButton,PremiumInput,SectionPanel} from '@/components/ui';
import {continenceProfileKey,continenceProfileFields,decodeContinenceProfile,emptyContinenceProfile,type ContinenceProfile} from '@/lib/careAssessment/continenceProfileDomain';
import type {CareAssessmentRisk} from '@/types/modules/careAssessment';
const labels:Record<string,string>={assessedAt:'Tatsächliche Erhebungszeit mit Zeitzone',sourceName:'Tatsächliche Auskunfts- oder Fachperson',urinarySituation:'Individuelle Harnkontinenzsituation oder konkrete Erhebungsgrenze',urinaryGoal:'Angestrebte Harnkontinenzsituation / persönliches Ziel',bowelSituation:'Individuelle Stuhlkontinenzsituation oder konkrete Erhebungsgrenze',bowelGoal:'Angestrebte Stuhlkontinenzsituation / persönliches Ziel',personPerspective:'Wünsche und Sicht der Person oder konkrete Gesprächsgrenze',resources:'Erhaltene Fähigkeiten und Ressourcen',urgeRecognition:'Wahrnehmung und Mitteilung des Ausscheidungsbedarfs',mobilityTransfer:'Weg zur Toilette, Mobilität und Transfer',clothingHandling:'Umgang mit Kleidung',toiletAccess:'Tatsächlicher Toilettenzugang und häusliches Umfeld',dailyHabits:'Individuelle Tagesstruktur und Gewohnheiten',nightSituation:'Individuelle Situation in der Nacht',aids:'Hilfsmittel und tatsächliche Nutzung / Klärungsbedarf',skinSituation:'Erhobene Hautsituation oder konkrete Untersuchungsgrenze',participation:'Auswirkungen auf Alltag, Wohlbefinden und Teilhabe',supportNeeded:'Konkreter individueller Unterstützungsbedarf',counseling:'Tatsächliche Information / Beratung oder begründete Grenze',personDecision:'Entscheidung der Person und Grenzen der Unterstützung',coordination:'Abgestimmte Beteiligte / Zuständigkeit oder konkreter Klärungsbedarf',reviewTriggers:'Individuelle Anlässe für erneute Einschätzung',nextReviewAt:'Individuell vereinbarter nächster Prüftermin mit Zeitzone'};
export function ContinenceProfilePanel({risk,locked,onChange}:{risk:CareAssessmentRisk;locked:boolean;onChange:(next:Partial<CareAssessmentRisk>)=>void}){
 let profile:ContinenceProfile|null=null,error='';
 if(risk.focusedAssessmentKey===continenceProfileKey){try{profile=decodeContinenceProfile(risk.focusedAssessmentResult);}catch(e){error=e instanceof Error?e.message:'Kontinenzprofil nicht lesbar.';}}
 const legacy=Object.keys(risk.focusedAssessmentResult??{}).length>0;
 const change=(key:keyof ContinenceProfile,value:string)=>{if(!locked&&profile)onChange({focusedAssessmentResult:{...profile,[key]:value,...(key==='source'?{sourceName:''}:{})}});};
 return <SectionPanel title="Individuelles Kontinenzprofil">
  <InfoBanner variant="info" message="Harn- und Stuhlsituation getrennt beschreiben. Eigene Erhebung, übermittelte Angaben und Grenzen kenntlich machen. Keine automatische Diagnose, Bewertung oder Standardmaßnahme. Das Profil dokumentiert Bedarf; tatsächliche Hilfe wird im Protokoll gesondert erfasst."/>
  {error?<InfoBanner variant="warning" message={`${error} Der gespeicherte Inhalt bleibt unverändert. Fachliche Prüfung ist bis zur Klärung gesperrt.`}/>:null}
  {profile?<View style={{gap:spacing.md}}>
   <Text style={{...typography.caption,color:colors.textMuted}}>Befundquelle ausdrücklich wählen</Text>
   <FilterChipGroup wrap options={[{key:'person',label:'Gespräch mit der Person'},{key:'reported',label:'Übermittelte Angaben'},{key:'professional',label:'Eigene fachliche Erhebung'},{key:'not_possible',label:'Erhebung nicht möglich'}]} value={profile.source} onChange={locked?undefined:v=>change('source',v)}/>
   {continenceProfileFields.filter(k=>k!=='source'&&(k!=='sourceName'||['reported','professional'].includes(profile!.source))).map(k=><PremiumInput key={k} label={labels[k]} accessibilityLabel={labels[k]} value={profile![k]} multiline={!['assessedAt','nextReviewAt','sourceName'].includes(k)} editable={!locked} onChangeText={v=>change(k,v)}/>)}
  </View>:!error?legacy?<>
   <InfoBanner variant="warning" message="Eine andere Kontinenzvertiefung ist gespeichert. Sie wird erhalten und nicht automatisch in dieses eigene Profil umgedeutet. Die strukturierte Überführung bleibt offen."/>
   <Text selectable style={{...typography.body,color:colors.textSecondary}}>{JSON.stringify(risk.focusedAssessmentResult,null,2)}</Text>
  </>:<PremiumButton title="Eigenes Kontinenzprofil ausdrücklich beginnen" variant="secondary" disabled={locked} onPress={()=>onChange({focusedAssessmentKey:continenceProfileKey,focusedAssessmentResult:emptyContinenceProfile()})}/>:null}
 </SectionPanel>;
}
