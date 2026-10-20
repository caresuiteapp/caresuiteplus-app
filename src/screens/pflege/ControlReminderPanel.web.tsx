import {useMemo,useState} from 'react';
import {Text,View} from 'react-native';
import {ErrorState,InfoBanner,LoadingState,PremiumButton,SectionPanel} from '@/components/ui';
import {controlReminders,type ControlReminder} from '@/lib/pflege/clinicalControlReminders';
import {type ControlRecord} from '@/lib/pflege/clinicalControlGateway';
import {useTreatmentCorrectionStyles} from './TreatmentCorrectionScreen.web';
const labels:Record<ControlReminder['kind'],string>={control_due:'Meine vereinbarte Kontrolle ist fällig',contact_due:'Tatsächlichen Eskalationskontakt prüfen',response_requested:'Meine Rückmeldung zu einem tatsächlichen Kontakt steht aus'};
const when=(v:string)=>new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',dateStyle:'short',timeStyle:'short'}).format(new Date(v));
export function ControlReminderPanel({records,tenant,client,actor,now,loading,error,canRespond,onOpen}:{records:ControlRecord[]|null;tenant:string;client:string;actor:string;now:number;loading:boolean;error:string|null;canRespond:boolean;onOpen:(record:ControlRecord,kind:string)=>void}){
 const styles=useTreatmentCorrectionStyles(),[count,setCount]=useState(10);
 const model=useMemo(()=>{try{return {rows:records?controlReminders(records,tenant,client,actor,now):null,error:null};}catch(e){return {rows:null,error:e instanceof Error?e.message:'Eigene Erinnerungen konnten nicht vollständig ermittelt werden.'};}},[records,tenant,client,actor,now]);
 const index=useMemo(()=>new Map((records??[]).map(r=>[r.task.id,r])),[records]);
 return <SectionPanel title="Meine Fristen und ausstehenden Rückmeldungen">
 <Text style={styles.body}>Aus dem vollständig geladenen zugänglichen Verlauf dieses Pflegefalls. Bei Kontrollfristen sind Zuständigkeit und Vertretung berücksichtigt. Rückmeldungen beziehen sich einzeln auf tatsächlich dokumentierte Kontakte.</Text>
 {error||model.error?<ErrorState message={error??model.error!}/>:loading?<LoadingState message="Eigene Fristen werden mit dem vollständigen Bestand abgeglichen…"/>:model.rows===null?<InfoBanner variant="info" message="Ein vollständiger zugänglicher Kontrollbestand ist erforderlich."/>:!model.rows.length?<InfoBanner variant="info" message="Im geladenen Stand gibt es für mich keine fällige Kontroll- oder Kontaktfrist und keine ausstehende Kontakt-Rückmeldung."/>:<>
 <Text style={styles.body}>{model.rows.length} einzelne Erinnerungen. Ein Auftrag kann mehrere unterschiedliche offene Handlungen enthalten.</Text>
 {model.rows.slice(0,count).map(r=>{const record=index.get(r.taskId)!;const first=record.events[0].draft;return <View key={r.key} style={styles.group}>
 <Text style={styles.body}>{labels[r.kind]} · {first.kind==='create'?first.title:r.taskId}</Text>
 <Text style={styles.body}>{r.kind==='response_requested'?'Tatsächlicher Kontakt':r.kind==='contact_due'&&r.basisEventId!==r.policyEventId?'Letzter gescheiterter Kontakt':'Individuell vereinbarte Frist'}: {when(r.dueAt)}</Text>
 <Text style={styles.body}>{r.kind==='response_requested'?'Für diese Rückmeldung ist keine zusätzliche Antwortfrist vereinbart. Der Kontaktzeitpunkt wird nicht als überfällige Antwortfrist gewertet.':r.kind==='contact_due'?'Ein früherer oder gescheiterter Kontakt ersetzt keine tatsächliche aktuelle Abstimmung.':'Die Anzeige dokumentiert keine Durchführung und erledigt den Auftrag nicht.'}</Text>
 <PremiumButton title={r.kind==='response_requested'&&canRespond?'Meine tatsächliche Rückmeldung dokumentieren':'Auftrag und Originalverlauf öffnen'} variant="secondary" onPress={()=>onOpen(record,r.kind==='response_requested'&&canRespond?'acknowledge':'')}/>
 </View>;})}
 {count<model.rows.length?<PremiumButton title="Weitere persönliche Erinnerungen anzeigen" variant="secondary" onPress={()=>setCount(n=>n+10)}/>:null}
 </>}
 <Text style={styles.body}>Diese Übersicht erzeugt keinen Nachrichtenversand, keine klinische Eskalation und keine Empfangsbestätigung. Änderungen anderer Personen werden beim erneuten Laden geprüft.</Text>
 </SectionPanel>;
}
