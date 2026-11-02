import {useEffect,useRef,useState} from 'react';
import {StyleSheet,Text,View} from 'react-native';
import {PremiumButton,PremiumCard,InfoBanner} from '@/components/ui';
import {webScaledFontMetric as font} from '@/design/web/webFontSize';
import {loadPersonalAssistOriginal} from '@/lib/gkvExchange/assistOriginalClient.web';
import type {AssistOriginalContext,AssistOriginalScope} from '@/lib/gkvExchange/assistOriginal';
import {assignmentSupabaseRepository} from '@/lib/assist/repositories/assignmentRepository.supabase.web';
type Props=AssistOriginalScope & {disabled?:boolean};
export function GkvAssistCompletion(props:Props){
 return <Completion key={JSON.stringify([props.tenantId,props.assignmentId,props.actorId,props.employeeId])} {...props}/>;
}
function Completion({disabled=false,...scope}:Props){
 const [context,setContext]=useState<AssistOriginalContext|null>(null),[busy,setBusy]=useState(true);
 const [hidden,setHidden]=useState(false),[error,setError]=useState<string|null>(null),[confirmed,setConfirmed]=useState(false);
 const mounted=useRef(false),flight=useRef(false);
 async function run(complete=false){
  if(flight.current||complete&&disabled)return;
  flight.current=true;setBusy(true);setError(null);setConfirmed(false);
  try{
   // Check the current personal session again before an explicit retry.
   const current=await loadPersonalAssistOriginal(scope);
   if(!mounted.current)return;
   setContext(current);setHidden(!current||current.phase==='legacy');
   if(complete&&current&&['ready','sealed'].includes(current.phase)){
    const result=await assignmentSupabaseRepository.prepareServiceRecord(scope.tenantId,scope.assignmentId);
    if(!mounted.current)return;
    if(!result.ok)throw new Error(result.error);
    if(!result.data?.id)throw new Error('Die Übergabe des Leistungsnachweises wurde noch nicht bestätigt.');
    const latest=await loadPersonalAssistOriginal(scope);
    if(!mounted.current)return;
    if(latest?.phase!=='sealed')throw new Error('Die persönliche Originalfassung konnte nicht erneut bestätigt werden.');
    setContext(latest);setConfirmed(true);
   }
  }catch(e){if(mounted.current){setError(e instanceof Error?e.message:'Der Nachweisstand konnte nicht geladen werden.');setHidden(false);}}
  finally{flight.current=false;if(mounted.current)setBusy(false);}
 }
 useEffect(()=>{mounted.current=true;void run();return()=>{mounted.current=false;};},[]);
 if(hidden)return null;
 const canComplete=context?.phase==='ready'||context?.phase==='sealed';
 return <PremiumCard contentStyle={styles.card}>
  <Text style={styles.title}>Persönlicher Leistungsnachweis</Text>
  <Text style={styles.text}>{busy?'Der gespeicherte Nachweisstand wird geprüft …':confirmed
   ?'Originalfassung, PDF und Übergabe an die Nachweisverwaltung sind bestätigt.'
   :context?.phase==='sealed'?'Die unterschriebene Originalfassung ist gesichert. PDF und Übergabe können hier erneut geprüft werden.'
   :context?.phase==='ready'?'Der Einsatz ist beendet. Die persönliche Originalfassung muss noch abgeschlossen werden.'
   :context?.phase==='awaiting_signature'?'Der Leistungsinhalt ist persönlich erfasst und gesichert. Die Unterschrift im Klient:innenportal steht noch aus. Nach der Unterschrift können Sie hier den Nachweis fertigstellen.'
   :context?.phase==='working'?'Der tatsächliche Einsatzabschluss ist noch nicht vollständig bestätigt. Bitte den Einsatzstatus prüfen.'
   :'Der gespeicherte Nachweisstand ist noch nicht bestätigt.'}</Text>
  {error?<InfoBanner message={error} variant="error"/>:null}
  <View style={styles.actions}>
   {canComplete&&!confirmed?<PremiumButton title={context?.phase==='ready'?'Nachweis abschließen':'PDF und Übergabe prüfen'} fullWidth disabled={busy||disabled} loading={busy} onPress={()=>void run(true)}/>:null}
   <PremiumButton title="Nachweisstand aktualisieren" variant="secondary" fullWidth disabled={busy||disabled} onPress={()=>void run()}/>
  </View>
  <Text style={styles.note}>Die Bestätigung des Monatsnachweises erfolgt anschließend gesondert.</Text>
 </PremiumCard>;
}
const styles=StyleSheet.create({
 card:{padding:18,gap:14,minWidth:0},title:{fontSize:font(20),lineHeight:font(28),fontWeight:'800',color:'#102D4E'},
 text:{fontSize:font(15),lineHeight:font(22),color:'#365672'},note:{fontSize:font(14),lineHeight:font(21),color:'#48627C'},
 actions:{gap:10,minWidth:0},
});
