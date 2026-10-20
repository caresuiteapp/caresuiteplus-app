import {Text,View} from 'react-native';
import {protocolNames as names,protocolWhen as when} from '@/lib/pflege/dailyProtocolLabels';
import type {ProtocolEntry,ProtocolQuantity,UrineEntry,FluidOutputEntry} from '@/lib/pflege/dailyProtocolDomain';
import {useTreatmentCorrectionStyles} from './TreatmentCorrectionScreen.web';
const quantity=(q:ProtocolQuantity)=>`${names[q.state]}${q.state==='not_measured'?'':` · ${q.value} ${names[q.unit]}`} · ${q.basis}`;
function OutputDetails({entry}:{entry:UrineEntry|FluidOutputEntry}){
 const styles=useTreatmentCorrectionStyles();
 return <View style={styles.group}>
  <Text style={styles.body}>{names[entry.occurrence]} · tatsächlich erhobene Menge: {quantity(entry.actual)}</Text>
  <Text style={styles.body}>{names[entry.collectionMode]} · Sammel-/Behälterbezug: {entry.collectionRef||'Kein Sammelbezug angegeben'}</Text>
  {entry.collectionMode==='interval_collection'?<Text style={styles.body}>Tatsächliche Sammlung: {when(entry.collectionStartAt)} bis {when(entry.collectionEndAt)}. Die Menge beschreibt diesen vollständigen Zeitraum.</Text>:null}
  {entry.kind==='urine'?<>
   <Text style={styles.body}>Ausscheidungsweg: {names[entry.method]} · Hilfeumfang: {names[entry.support]}</Text>
   <Text style={styles.body}>Hilfsmittel: {names[entry.aidsState]}{entry.aidsDetail?` · ${entry.aidsDetail}`:''}</Text>
   <Text style={styles.body}>Farbe: {entry.color||'Nicht beurteilt'} · Klarheit: {entry.clarity||'Nicht beurteilt'} · Geruch: {entry.odor||'Nicht beurteilt'}</Text>
   <Text style={styles.body}>Personenentscheidung / Unterstützungsgrenze: {entry.personDecision}</Text>
  </>:<>
   <Text style={styles.body}>Ausfuhrweg: {names[entry.route]} · tatsächlicher Ursprung: {entry.site}</Text>
   <Text style={styles.body}>Beschaffenheit: {entry.appearance||'Nicht beurteilt'}</Text>
  </>}
  <Text style={styles.body}>Beschwerden / Beobachtungsgrenze: {entry.symptoms}</Text>
 </View>;
}
export function ProtocolEntryDetails({entry}:{entry:ProtocolEntry}){
 const styles=useTreatmentCorrectionStyles();
 return <View style={styles.group}>
  <Text style={styles.body}>{names[entry.source]}{entry.source==='reported'?` · Auskunft: ${entry.reportedBy}`:''} · tatsächliches Ereignis: {when(entry.occurredAt)}</Text>
  {entry.kind==='urine'||entry.kind==='fluid_output'?<OutputDetails entry={entry}/>:entry.kind==='stool'?<>
   <Text style={styles.body}>{names[entry.occurrence]} · Menge: {names[entry.amount]} · Konsistenz: {names[entry.consistency]}</Text>
   <Text style={styles.body}>Farbe: {entry.color||'Nicht beurteilt'}</Text>
  </>:<>
   <Text style={styles.body}>{entry.description} · {names[entry.outcome]} · Hilfeumfang: {names[entry.support]}</Text>
   <Text style={styles.body}>Angeboten: {quantity(entry.offered)} · Tatsächlich aufgenommen: {quantity(entry.actual)}</Text>
  </>}
  <Text style={styles.body}>Beobachtung: {entry.observation}</Text>
  <Text style={styles.body}>Reaktion: {entry.reaction}</Text>
  {entry.reason?<Text style={styles.body}>Grund / Grenze: {entry.reason}</Text>:null}
  <Text style={styles.body}>{names[entry.reviewState]}{entry.reviewAt?` · ${when(entry.reviewAt)}`:''} · {entry.reviewReason}</Text>
  <Text style={styles.body}>Eine vereinbarte Kontrolle kann ausdrücklich einem Kontrollauftrag zugeordnet werden. Zuständigkeit und Fristen werden dabei gesondert festgelegt.</Text>
 </View>;
}
