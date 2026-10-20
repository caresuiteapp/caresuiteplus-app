import {useMemo,useState} from 'react';
import {Text,View} from 'react-native';
import {ErrorState,InfoBanner,PremiumButton,PremiumInput,SectionPanel} from '@/components/ui';
import {protocolFluidWindow,fluidQualityKeys} from '@/lib/pflege/protocolFluidWindow';
import {protocolNames,protocolWhen} from '@/lib/pflege/dailyProtocolLabels';
import type {ProtocolRecord} from '@/lib/pflege/dailyProtocolDomain';
import {useTreatmentCorrectionStyles} from './TreatmentCorrectionScreen.web';
const quality={observedMeasured:'Eigene Beobachtung · gemessen',observedEstimated:'Eigene Beobachtung · geschätzt',reportedMeasured:'Fremdangabe · gemessen angegeben',reportedEstimated:'Fremdangabe · geschätzt angegeben'};
const states={included:'Menge im Ausschnitt berücksichtigt',boundary_crossing:'Sammlung überschreitet die Grenze · keine anteilige Zuordnung',unquantified:'Tatsächlicher Vorgang ohne erhobene Menge',no_observation:'Keine bestätigte tatsächliche Menge dieses Vorgangs'};
const amount=(v:string|null)=>v===null?'Nicht berechenbar / keine passende quantifizierte Quelle':`${v} ml`;
export function ProtocolFluidWindowPanel({records,tenant,client,disabled}:{records:ProtocolRecord[];tenant:string;client:string;disabled:boolean}){
 const styles=useTreatmentCorrectionStyles(),[from,setFrom]=useState(''),[to,setTo]=useState(''),[applied,setApplied]=useState<{from:string;to:string}|null>(null),[count,setCount]=useState(20);
 const result=useMemo(()=>{try{return {data:applied?protocolFluidWindow(records,tenant,client,applied.from,applied.to):null,error:null};}catch(e){return {data:null,error:e instanceof Error?e.message:'Auswertung nicht vollständig verfügbar.'};}},[records,tenant,client,applied]);
 return <SectionPanel title="Dokumentierte Ein- und Ausfuhr im abgegrenzten Ausschnitt">
  <InfoBanner variant="info" message="Trinkaufnahme, Urin und gesonderte Flüssigkeitsausfuhr aus diesem Protokollbestand. Infusionen, Sondenzufuhr, Nahrungswasser und nicht erhobene Verluste sind hier nicht angebunden. Dies ist keine vollständige oder medizinisch bewertete Flüssigkeitsbilanz."/>
  <PremiumInput label="Beginn mit Zeitzone, einschließlich (ISO-Zeitpunkt)" accessibilityLabel="Beginn des Mengenausschnitts" value={from} onChangeText={v=>{setFrom(v);setApplied(null);}}/>
  <PremiumInput label="Ende mit Zeitzone, Einzelereignisse vor diesem Zeitpunkt" accessibilityLabel="Ende des Mengenausschnitts" value={to} onChangeText={v=>{setTo(v);setApplied(null);}}/>
  <Text style={styles.body}>Bestätigte Intervallsammlungen werden nur vollständig zugeordnet. Eine Sammlung, die genau am Ende endet, gehört zum Ausschnitt; ein Einzelereignis genau am Ende gehört zum nächsten Ausschnitt.</Text>
  <PremiumButton title="Diesen dokumentierten Ausschnitt auswerten" variant="secondary" disabled={disabled} onPress={()=>{setCount(20);setApplied({from,to});}}/>
  {result.error?<ErrorState message={result.error}/>:null}
  {result.data?<>
   <Text style={styles.body}>Ausgewertet: {protocolWhen(result.data.from)} bis {protocolWhen(result.data.to)}. {result.data.rows.length} relevante aktuelle Originalbezüge.</Text>
   {result.data.blocked?<InfoBanner variant="warning" message="Überlappende oder doppelte Sammlungen mit demselben tatsächlichen Bezug. Mengenrechnung gesperrt; Originale und Sammelgrenzen prüfen und erforderliche Berichtigungen begründen."/>:null}
   {fluidQualityKeys.map(key=><View key={key} style={styles.group}>
    <Text style={styles.body}>{quality[key]}</Text>
    <Text style={styles.body}>Trinkaufnahme: {amount(result.data!.groups[key].inputMl)} · Urin: {amount(result.data!.groups[key].urineMl)} · weitere Ausfuhr: {amount(result.data!.groups[key].otherOutputMl)}</Text>
    <Text style={styles.body}>Rechnerische Differenz dieses Ausschnitts: {amount(result.data!.groups[key].documentedDifferenceMl)}. Fehlende Gegenseite wird nicht als 0 ml angenommen.</Text>
   </View>)}
   <Text style={styles.body}>Ohne erhobene Menge: eigene Aufnahme {result.data.unknown.observedInput}, fremd angegebene Aufnahme {result.data.unknown.reportedInput}, eigene Ausfuhr {result.data.unknown.observedOutput}, fremd angegebene Ausfuhr {result.data.unknown.reportedOutput}. Grenzüberschreitende Sammlungen: {result.data.boundaryCrossingCount}. Nicht bestätigte Vorgänge: {result.data.noObservationCount}.</Text>
   {result.data.conflicts.map(c=><Text key={c.rootIds.join(':')} style={styles.body}>Sammelbezug {c.collectionRef}: Originale {c.rootIds.join(' und ')} überschneiden sich.</Text>)}
   {result.data.rows.slice(0,count).map(row=><View key={row.record.root.id} style={styles.group}>
    <Text style={styles.body}>{protocolNames[row.entry.kind]} · {protocolWhen(row.entry.occurredAt)} · {states[row.state]}</Text>
    <Text style={styles.body}>Originalbezug {row.record.root.id} · aktuelle Fassung {row.record.headId}</Text>
   </View>)}
   {result.data.rows.length>count?<PremiumButton title="Weitere Mengenbelege anzeigen" variant="secondary" onPress={()=>setCount(n=>n+20)}/>:null}
  </>:null}
 </SectionPanel>;
}
