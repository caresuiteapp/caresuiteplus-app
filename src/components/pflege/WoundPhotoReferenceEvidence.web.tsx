import {useEffect,useRef,useState} from 'react';
import {StyleSheet,Text,View} from 'react-native';
import {ErrorState,FilterChip,InfoBanner,PremiumButton,SectionPanel} from '@/components/ui';
import {useCareLightPalette} from '@/design/tokens/carelightadaptive';
import {spacing,typography} from '@/theme';
import {woundUuid} from '@/lib/pflege/woundCareDomain';
import {isKnownWoundEditorRole} from '@/lib/pflege/woundEditorRequestGuard.web';
import {sameWoundComparisonOriginal,type WoundComparisonOriginals} from '@/lib/pflege/woundAssessmentComparison.web';
import {captureWoundPhotoReferenceEvidence,selectWoundPhotoReferenceEvidence} from '@/lib/pflege/woundPhotoReferenceEvidence.web';
type Props={source:WoundComparisonOriginals;tenantId:string;profileId:string;profileRole:string|null;runtimeTenantId:string|null;runtimeRole:string|null;woundId:string;canRead:boolean;readBlocked:boolean;readTicket:symbol|null;isCurrentReceipt:(ticket:symbol,source:WoundComparisonOriginals)=>boolean};
const raw=(v:unknown)=>v===undefined?'Nicht im Original enthalten':v===null?'Original: null':typeof v==='string'?(v||'Original: leere Angabe'):JSON.stringify(v);
export function WoundPhotoReferenceEvidence(props:Props){
 const {c}=useCareLightPalette(),styles=StyleSheet.create({group:{gap:spacing.sm,minWidth:0},choices:{flexDirection:'row',flexWrap:'wrap',gap:spacing.sm,minWidth:0},body:{...typography.body,color:c.text,flexShrink:1,maxWidth:'100%'},note:{...typography.caption,color:c.muted,flexShrink:1,maxWidth:'100%'},raw:{...typography.caption,color:c.text,flexShrink:1,maxWidth:'100%'},entry:{gap:spacing.xs,paddingVertical:spacing.sm,borderBottomWidth:1,borderColor:c.border,minWidth:0}});
 const [owner]=useState(()=>({tenantId:props.tenantId,profileId:props.profileId,profileRole:props.profileRole,woundId:props.woundId,clientId:props.source&&typeof props.source==='object'?Object.getOwnPropertyDescriptor(Object.getOwnPropertyDescriptor(props.source,'row')?.value??{},'client_id')?.value:undefined}));
 const alive=useRef(true),latest=useRef(props);latest.current=props;
 const [selection,setSelection]=useState<{ticket:symbol;id:string;showRaw:boolean}|null>(null),[visible,setVisible]=useState<{ticket:symbol;count:number}|null>(null),[error,setError]=useState<string|null>(null);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 function current(){const p=latest.current;if(!alive.current||![owner.tenantId,owner.profileId,owner.woundId,owner.clientId].every(woundUuid)||!isKnownWoundEditorRole(owner.profileRole)||p.tenantId!==owner.tenantId||p.profileId!==owner.profileId||p.profileRole!==owner.profileRole||p.runtimeRole!==owner.profileRole||p.runtimeTenantId!==owner.tenantId||p.woundId!==owner.woundId||p.canRead!==true||p.readBlocked||!p.readTicket)throw Error('Aktueller eigener Wund-Originalstand für die Referenzbelege fehlt.');captureWoundPhotoReferenceEvidence(p.source,scope);if(!p.isCurrentReceipt(p.readTicket,p.source))throw Error('Aktueller eigener Wund-Originalstand für die Referenzbelege fehlt.');return p;}
 const scope={tenantId:owner.tenantId,clientId:String(owner.clientId),woundId:owner.woundId};
 let evidence:ReturnType<typeof captureWoundPhotoReferenceEvidence>|null=null,readError:string|null=null;
 try{evidence=captureWoundPhotoReferenceEvidence(current().source,scope);}catch(e){readError=e instanceof Error?e.message:'Originalstand neu laden.';}
 const renderOriginal=evidence?.originals,renderTicket=props.readTicket;
 function active(){const p=current();if(!renderOriginal||renderTicket!==p.readTicket||!sameWoundComparisonOriginal(renderOriginal,p.source))throw Error('Referenzoriginalstand geändert. Befund erneut auswählen.');return captureWoundPhotoReferenceEvidence(p.source,scope);}
 function select(id:string){try{const e=active();selectWoundPhotoReferenceEvidence(e.originals,scope,id);setSelection({ticket:renderTicket!,id,showRaw:false});setError(null);}catch(e){if(alive.current)setError(e instanceof Error?e.message:'Originalbefund erneut auswählen.');}}
 function toggleRaw(){try{const e=active();if(selection?.ticket!==renderTicket)return;selectWoundPhotoReferenceEvidence(e.originals,scope,selection.id);setSelection(s=>s?.ticket===renderTicket&&s.id===selection.id?{...s,showRaw:!s.showRaw}:s);}catch{}}
 function more(){try{const e=active();setVisible(s=>({ticket:renderTicket!,count:Math.min(e.assessments.length,(s?.ticket===renderTicket?s.count:20)+20)}));}catch{}}
 const count=visible?.ticket===renderTicket?visible.count:20,selected=selection?.ticket===renderTicket&&evidence?selection:null;
 let selectedEvidence:ReturnType<typeof selectWoundPhotoReferenceEvidence>|null=null;
 if(selected&&evidence)try{selectedEvidence=selectWoundPhotoReferenceEvidence(evidence.originals,scope,selected.id);}catch(e){readError=e instanceof Error?e.message:'Originalbefund prüfen.';}
 return <SectionPanel title="Fotoverweise im Originalbefund" subtitle="Referenzbelege und ihre äußere Wundzuordnung"><View style={styles.group}>
  <InfoBanner variant="info" message="Vorhandene Verweise sind keine bestätigten Bildoriginale. Bildherkunft, Aufnahmezeit, Bildqualität und Einwilligungsgrundlage sind in diesem Lesestand nicht nachgewiesen. Es werden keine Bilder geladen."/>
  {readError||error?<ErrorState message={readError??error??'Referenzstand prüfen.'}/>:null}
  {evidence?<>
   {!evidence.assessments.length?<InfoBanner variant="info" message="Kein eigener Originalbefund mit einer prüfbaren Referenzangabe geliefert."/>:null}
   <View style={styles.choices}>{evidence.assessments.slice(0,count).map(a=><FilterChip key={a.assessmentId} style={{maxWidth:'100%',flexShrink:1}} label={`Befund ${a.assessmentId} · Erfasst ${raw(a.snapshots[0].original.created_at)}`} selected={selected?.id===a.assessmentId} onPress={()=>select(a.assessmentId)}/>)}</View>
   {count<evidence.assessments.length?<PremiumButton title="Weitere Originalbefunde anzeigen" variant="secondary" onPress={more}/>:null}
  </>:null}
  {selectedEvidence?<>
   {selectedEvidence.snapshots.map(s=><View key={s.correction?String(s.correction.id):s.assessmentId} style={styles.entry}>
    <Text style={styles.body}>{s.correction?'Historische Originalfassung bei Berichtigung':'Derzeit gelieferte Originalbefundfassung'} · Befund {s.assessmentId}</Text>
    {s.correction?<Text style={styles.note}>Berichtigung {raw(s.correction.id)} · Fassung {raw(s.correction.version)} · erfasst {raw(s.correction.created_at)} · Originalautor {raw(s.correction.recorded_by_name)} ({raw(s.correction.recorded_by)})</Text>:null}
    <Text style={styles.note}>Mandant {raw(s.original.tenant_id)} · Pflegefall {raw(s.original.client_id)} · Wundfall {raw(s.original.wound_case_id)}</Text>
    <Text style={styles.body}>Beobachtet: {raw(s.original.observed_at)} · Erfasst: {raw(s.original.created_at)}</Text>
    <Text style={styles.note}>Ursprüngliches assessed_at: {raw(s.original.assessed_at)} · Originalautor {raw(s.original.recorded_by_name)} ({raw(s.original.recorded_by)})</Text>
    <Text style={styles.body}>{s.state==='missing'?'Referenzangabe fehlt im gelieferten Original.':s.state==='empty'?'Original enthält eine leere Referenzliste. Daraus folgt keine Aussage über andere Bildbestände.':'Original enthält ungeprüfte Referenzeinträge; deren Inhalt bestätigt kein Bild oder dessen Zugehörigkeit.'}</Text>
    {selected?.showRaw?<Text selectable style={styles.raw}>{s.state==='missing'?'Kein Originalfeld photo_refs enthalten.':JSON.stringify(s.references,null,2)}</Text>:null}
   </View>)}
   <PremiumButton title={selected?.showRaw?'Originalverweise ausblenden':'Originalverweise als Text anzeigen'} variant="secondary" onPress={toggleRaw}/>
  </>:null}
 </View></SectionPanel>;
}
