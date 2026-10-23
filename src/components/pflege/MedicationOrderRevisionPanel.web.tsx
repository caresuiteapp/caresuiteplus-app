import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {StyleSheet,Text,View} from 'react-native';
import {ErrorState,FilterChipGroup,InfoBanner,LoadingState,PremiumBadge,PremiumButton,PremiumInput,SectionPanel,SuccessState} from '@/components/ui';
import {useUnsavedWebChanges} from '@/hooks/useUnsavedWebChanges.web';
import {useCareLightPalette} from '@/design/tokens/carelightadaptive';
import {makeMedicationOrderRevisionPacket,medicationOrderRevisionOrderIssue,nativeMedicationOrderRevisionDraft,type MedicationOrderRevisionOrder,type MedicationOrderRevisionPacket,type MedicationOrderRevision} from '@/lib/pflege/medicationOrderRevisionDomain.web';
import {proposeMedicationOrderRevision,readMedicationOrderRevisionWorkspace} from '@/lib/pflege/medicationOrderRevisionService.web';
import {sameWoundJson,woundUuid} from '@/lib/pflege/woundCareDomain';
import {medicationTimeDisplay} from '@/lib/pflege/medicationTimeDisplay.web';
import type {RoleKey} from '@/types';
import {spacing,typography} from '@/theme';

type Row=Record<string,unknown>;
type Draft=ReturnType<typeof nativeMedicationOrderRevisionDraft>;
type Workspace={order:Row;sources:Array<{source:Row;archive:Row}>;items:MedicationOrderRevision[]};
type RevisionPanelContext={tenantId:string;clientId:string;medicationId:string;actorId:string;role:RoleKey|null;profileRole:RoleKey|null;canView:boolean;canSources:boolean;canManage:boolean;blocked:boolean;currentOrderVersion:string;onSaved?():void;isLeaving?():boolean;registerLeave?(fn:(()=>Promise<boolean>)|null):void;onEditingChange?(editing:boolean):boolean|void};
const orderFields:Array<{key:keyof MedicationOrderRevisionOrder;label:string;native:string}>=[
 {key:'medicationName',label:'Präparat',native:'name'},{key:'activeIngredient',label:'Wirkstoff',native:'active_ingredient'},
 {key:'strength',label:'Stärke',native:'strength'},{key:'form',label:'Darreichungsform',native:'form'},
 {key:'dose',label:'Verordnete Dosis',native:'prescribed_dose'},{key:'unit',label:'Dosiseinheit',native:'dose_unit'},
 {key:'route',label:'Applikationsweg',native:'route'},{key:'prescriber',label:'Verordnende Person',native:'prescribed_by'},
 {key:'validFrom',label:'Gültig ab',native:'start_date'},{key:'validUntil',label:'Gültig bis',native:'end_date'},
 {key:'indication',label:'Indikation',native:'indication'},{key:'isPrn',label:'Bedarfsmedikation',native:'is_prn'},
 {key:'minimumIntervalMinutes',label:'Mindestabstand in Minuten',native:'minimum_interval_minutes'},
 {key:'maximumDose',label:'Höchstmenge im Bezugszeitraum',native:'maximum_dose'},
 {key:'maximumDoseUnit',label:'Einheit der Höchstmenge',native:'maximum_dose_unit'},
 {key:'maximumPeriodHours',label:'Bezugszeitraum in Stunden',native:'maximum_period_hours'},
];
const display=(value:unknown)=>value===null||value===undefined||value===''?'Nicht hinterlegt':typeof value==='boolean'?value?'Ja':'Nein':typeof value==='string'||typeof value==='number'?String(value):JSON.stringify(value);
const time=(value:unknown)=>typeof value==='string'?medicationTimeDisplay(value).display:'Zeitpunkt nicht hinterlegt';
function revisionOrderFromDraft(draft:Draft):MedicationOrderRevisionOrder{
 return {...draft,isPrn:draft.isPrn==='true'?true:draft.isPrn==='false'?false:null,validUntil:draft.validUntil===''?null:draft.validUntil,minimumIntervalMinutes:draft.minimumIntervalMinutes===''?null:draft.minimumIntervalMinutes,maximumDose:draft.maximumDose===''?null:draft.maximumDose,maximumPeriodHours:draft.maximumPeriodHours===''?null:draft.maximumPeriodHours} as MedicationOrderRevisionOrder;
}
function revisionScope(context:RevisionPanelContext){return {tenantId:context.tenantId,clientId:context.clientId,medicationId:context.medicationId};}
function useMedicationOrderRevisionController(context:RevisionPanelContext){
 const [owner]=useState(()=>({tenantId:context.tenantId,clientId:context.clientId,medicationId:context.medicationId,actorId:context.actorId,role:context.profileRole}));
 const alive=useRef(true),current=useRef(context);current.current=context;
 const [workspace,setWorkspace]=useState<Workspace|null>(null),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),[success,setSuccess]=useState<string|null>(null),[draft,setDraft]=useState<Draft|null>(null),[sourceId,setSourceId]=useState(''),[reason,setReason]=useState(''),[uncertain,setUncertain]=useState(false),[confirmed,setConfirmed]=useState(false);
 const flight=useRef(false),saved=useRef(false),editing=useRef(false),session=useRef(0),editorEpoch=useRef(0),loadFlight=useRef(false),generation=useRef(0),pending=useRef<MedicationOrderRevisionPacket|null>(null),baseline=useRef<Row|null>(null),draftRef=useRef(draft),sourceRef=useRef(sourceId),reasonRef=useRef(reason);draftRef.current=draft;sourceRef.current=sourceId;reasonRef.current=reason;const renderedSession=session.current;
 const ownRead=useCallback(()=>{const c=current.current;return alive.current&&[owner.tenantId,owner.clientId,owner.medicationId,owner.actorId].every(woundUuid)&&!!owner.role&&c.tenantId===owner.tenantId&&c.clientId===owner.clientId&&c.medicationId===owner.medicationId&&c.actorId===owner.actorId&&c.role===owner.role&&c.profileRole===owner.role&&c.canView&&c.canSources&&c.canManage;},[]);
 const liveRead=()=>ownRead()&&!current.current.blocked;
 const canOperate=()=>!current.current.isLeaving?.()&&liveRead()&&current.current.canManage&&!flight.current&&!pending.current&&!saved.current&&!loadFlight.current;
 const canEdit=()=>editing.current&&canOperate()&&baseline.current?.updated_at===current.current.currentOrderVersion;
 const load=useCallback(async()=>{
  if(!ownRead()||current.current.blocked||loadFlight.current||flight.current)return;loadFlight.current=true;const request=++generation.current;setLoading(true);setError(null);
  try{const result=await readMedicationOrderRevisionWorkspace(revisionScope(current.current),current.current.role,()=>ownRead()&&!current.current.blocked&&generation.current===request);if(!ownRead()||generation.current!==request)return;if(!result.ok){setError(result.error);return;}setWorkspace(result.data);}
  catch{if(ownRead()&&generation.current===request)setError('Verordnungsfassungen konnten nicht vollständig geladen werden.');}
  finally{loadFlight.current=false;if(alive.current&&generation.current===request)setLoading(false);}
 },[]);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;generation.current++;editing.current=false;current.current.onEditingChange?.(false);};},[]);
 useEffect(()=>{if(liveRead())void load();},[context.canView,context.canSources,context.canManage,context.blocked,context.role,context.profileRole,context.currentOrderVersion]);
 const orderChanged=!!baseline.current&&baseline.current.updated_at!==context.currentOrderVersion;
 const dirty=!!draft&&!confirmed;
 const confirmLeave=useUnsavedWebChanges(dirty||uncertain,busy||uncertain,undefined,()=>{if(!localOwner()||flight.current||pending.current)return null;const captured=leaveSnapshot();return()=>localOwner()&&!flight.current&&!pending.current&&sameWoundJson(captured,leaveSnapshot());}),leavePrompt=useRef(confirmLeave);leavePrompt.current=confirmLeave;
 const leaveSnapshot=()=>{const c=current.current;return structuredClone({tenantId:c.tenantId,clientId:c.clientId,medicationId:c.medicationId,actorId:c.actorId,role:c.role,profileRole:c.profileRole,canView:c.canView,canSources:c.canSources,canManage:c.canManage,blocked:c.blocked,currentOrderVersion:c.currentOrderVersion,session:session.current,epoch:editorEpoch.current,generation:generation.current,draft:draftRef.current,sourceId:sourceRef.current,reason:reasonRef.current,saved:saved.current});};
 const localOwner=()=>{const c=current.current;return alive.current&&c.tenantId===owner.tenantId&&c.clientId===owner.clientId&&c.medicationId===owner.medicationId&&c.actorId===owner.actorId&&c.role===owner.role&&c.profileRole===owner.role;};
 const guardedLeave=useCallback(async()=>{
  if(!localOwner()||flight.current||pending.current)return false;
  const before=leaveSnapshot(),prompt=leavePrompt.current;if(!await prompt())return false;
  return localOwner()&&!flight.current&&!pending.current&&prompt===leavePrompt.current&&sameWoundJson(before,leaveSnapshot());
 },[]);
 useEffect(()=>{context.registerLeave?.(guardedLeave);return()=>context.registerLeave?.(null);},[context.registerLeave,guardedLeave]);
 function start(){
  if(!canOperate()||editing.current||!workspace||workspace.order.updated_at!==current.current.currentOrderVersion)return;
  if(current.current.onEditingChange?.(true)===false)return;editing.current=true;session.current++;editorEpoch.current++;baseline.current=structuredClone(workspace.order);draftRef.current=nativeMedicationOrderRevisionDraft(workspace.order);sourceRef.current='';reasonRef.current='';setDraft(draftRef.current);setSourceId('');setReason('');setConfirmed(false);setError(null);setSuccess(null);
 }
 function change<K extends keyof Draft>(key:K,value:Draft[K]){if(renderedSession!==session.current||!canEdit()||!draftRef.current)return;editorEpoch.current++;draftRef.current={...draftRef.current,[key]:value};setDraft(draftRef.current);}
 async function submit(){
  if(renderedSession!==session.current||current.current.isLeaving?.()||!editing.current||flight.current||saved.current||!ownRead())return;const replay=pending.current!==null;
  if(!pending.current){
   if(!canEdit()||!draftRef.current||!baseline.current||baseline.current.updated_at!==current.current.currentOrderVersion)return;
   try{pending.current=makeMedicationOrderRevisionPacket({requestId:globalThis.crypto.randomUUID(),...revisionScope(current.current),actorId:owner.actorId,expectedUpdatedAt:String(baseline.current.updated_at),sourceId:sourceRef.current,reason:reasonRef.current,order:revisionOrderFromDraft(draftRef.current)});}
   catch(cause){setError(cause instanceof Error?cause.message:'Vollständige Übertragung und Quellenbezug prüfen.');return;}
  }
  const packet=pending.current;if(!packet)return;flight.current=true;setBusy(true);setError(null);setSuccess(null);
  try{
   const result=await proposeMedicationOrderRevision(packet,current.current.role,ownRead);
   if(!alive.current)return;
   if(!result.ok){setError(result.error);setUncertain(replay||result.uncertain===true);if(!replay&&result.uncertain!==true)pending.current=null;return;}
   if(!ownRead()){setUncertain(true);setError('Die gespeicherte Übertragung unter dem ursprünglichen eigenen Bezug erneut prüfen.');return;}
   setWorkspace(previous=>previous?{...previous,items:[result.data,...previous.items.filter(item=>item.id!==result.data.id)]}:previous);pending.current=null;saved.current=true;setUncertain(false);setConfirmed(true);setSuccess('Der Übertragungsvorschlag wurde gespeichert und vollständig zurückgelesen. Die aktive Verordnung wurde dadurch nicht geändert.');current.current.onSaved?.();
  }catch{if(alive.current){setUncertain(true);setError('Die Speicherbestätigung fehlt. Dieselbe unveränderte Anfrage erneut prüfen.');}}
  finally{flight.current=false;if(alive.current)setBusy(false);}
 }
 async function close(){if(renderedSession!==session.current||!await guardedLeave())return;if(!localOwner()||renderedSession!==session.current)return;editing.current=false;session.current++;draftRef.current=null;sourceRef.current='';reasonRef.current='';current.current.onEditingChange?.(false);editorEpoch.current++;baseline.current=null;saved.current=false;setDraft(null);setSourceId('');setReason('');setConfirmed(false);setError(null);setSuccess(null);}
 const order=draft?revisionOrderFromDraft(draft):null;
 const issue=order?medicationOrderRevisionOrderIssue(order):null;
 return {workspace,loading,busy,error,success,draft,sourceId,reason,uncertain,confirmed,orderChanged,issue,baseline:baseline.current,canRead:ownRead(),locked:!canOperate(),load,start,change,submit,close,confirmLeave:guardedLeave,setSource:(id:string)=>{if(renderedSession===session.current&&canEdit()&&workspace?.sources.some(item=>item.source.id===id)){editorEpoch.current++;sourceRef.current=id;setSourceId(id);}},setReason:(value:string)=>{if(renderedSession===session.current&&canEdit()){editorEpoch.current++;reasonRef.current=value;setReason(value);}}};
}

export function MedicationOrderRevisionPanel(context:RevisionPanelContext){
 const styles=useRevisionStyles(),controller=useMedicationOrderRevisionController(context),[expanded,setExpanded]=useState<string|null>(null);
 if(!controller.canRead)return <SectionPanel title="Verordnungsfassungen"><InfoBanner variant="warning" message="Der eigene Zugriff auf Verordnung und vertrauliche Quellen fehlt. Ein angefangener Vorschlag und seine unveränderte Anfrage bleiben in dieser Ansicht erhalten."/>{controller.uncertain?<PremiumButton title="Anfrage erneut prüfen" disabled loading={controller.busy} onPress={controller.submit}/>:null}</SectionPanel>;
 const workspace=controller.workspace;
 return <SectionPanel title="Verordnungsfassungen" subtitle="Strukturierte Übertragung aus einer archivierten Quelle und unveränderter Verlauf">
  <View style={styles.body}>
   <InfoBanner variant="info" message="Ein Vorschlag hält die übertragenen Angaben und die archivierte Quelle fest. Er ändert die aktive Verordnung nicht und ist keine ärztliche Freigabe. Eine technische Übernahme erfordert eine getrennt nachgewiesene Prüfberechtigung."/>
   {controller.error?<ErrorState message={controller.error}/>:null}{controller.success?<SuccessState message={controller.success}/>:null}
   {context.blocked?<InfoBanner variant="warning" message="Die Medikationsakte wird neu geladen oder in einem anderen Formular bearbeitet. Der angefangene Vorschlag bleibt erhalten."/>:null}
   {controller.loading?<LoadingState message="Native Verordnung, Archivquellen und vollständiger Fassungsverlauf werden geladen…"/>:null}
   <View style={styles.actions}><PremiumButton title="Bestand aktualisieren" variant="secondary" disabled={controller.busy||controller.loading||controller.uncertain||context.blocked} onPress={controller.load}/>{!controller.draft&&workspace&&context.canManage?<PremiumButton title="Neue Übertragung" disabled={controller.locked||workspace.order.updated_at!==context.currentOrderVersion} onPress={controller.start}/>:null}</View>
   {controller.draft?<View style={styles.editor}>
    <Text style={styles.heading}>Strukturierten Vorschlag erfassen</Text><Text style={styles.note}>Ausgangsstand: {time(controller.baseline?.updated_at)}. Fehlende native Angaben bleiben leer; Art und Bedarfsgrenzen werden ausdrücklich ausgewählt oder eingetragen.</Text>
    {controller.orderChanged?<InfoBanner variant="warning" message="Die aktive Verordnung wurde zwischenzeitlich geändert. Einen unklaren gespeicherten Auftrag weiterhin mit derselben Anfrage prüfen. Einen noch nicht gesendeten Entwurf schließen und mit dem aktuellen Stand beginnen."/>:null}
    {controller.uncertain?<InfoBanner variant="warning" title="Speicherergebnis ungeklärt" message="Anfrage und Inhalt bleiben unverändert. Die Wiederholung prüft denselben Übertragungsvorschlag; ein zweiter Vorschlag wird nicht angelegt."/>:null}
    <Text style={styles.label}>Archivierte Originalquelle *</Text>
    {workspace?.sources.length?<FilterChipGroup wrap options={workspace.sources.map(item=>{const snapshot=item.source.document_snapshot as Row|undefined;return {key:String(item.source.id),label:`${display(snapshot?.title)} · ${display(snapshot?.file_name)}`};})} value={controller.sourceId} onChange={controller.locked?undefined:controller.setSource}/>:<InfoBanner variant="warning" message="Keine passende bereitgestellte Archivquelle vorhanden. Die Originalunterlage zuerst als Quelle zuordnen und ihre Archivkopie bestätigen."/>}
    <View style={styles.fields}>{orderFields.filter(field=>field.key!=='isPrn').map(field=><View key={field.key} style={field.key==='indication'?styles.fullField:styles.field}><PremiumInput label={field.label+(field.key==='validUntil'?' (optional)':'')} accessibilityLabel={field.label} value={controller.draft![field.key]} editable={!controller.locked&&!controller.orderChanged} onChangeText={value=>controller.change(field.key,value)} placeholder={field.key==='validFrom'||field.key==='validUntil'?'JJJJ-MM-TT':undefined} multiline={field.key==='indication'}/></View>)}</View>
    <Text style={styles.label}>Verordnungsart *</Text><FilterChipGroup wrap options={[{key:'false',label:'Regelmedikation'},{key:'true',label:'Bedarfsmedikation'}]} value={controller.draft.isPrn} onChange={controller.locked||controller.orderChanged?undefined:value=>controller.change('isPrn',value)}/>
    <Text style={styles.note}>Für Bedarfsmedikation sind Mindestabstand, Höchstmenge, Originaleinheit und Bezugszeitraum erforderlich. Bei Regelmedikation bleiben diese vier Felder leer. Dezimalwerte mit Punkt eingeben.</Text>
    <PremiumInput label="Begründung der Übertragung (mindestens 10 Zeichen) *" accessibilityLabel="Begründung der strukturierten Verordnungsübertragung" value={controller.reason} editable={!controller.locked&&!controller.orderChanged} onChangeText={controller.setReason} maxLength={2000} multiline/>
    {controller.issue&&!controller.confirmed?<Text style={styles.note}>{controller.issue}</Text>:null}
    <View style={styles.actions}>{!controller.confirmed?<PremiumButton title={controller.busy?'Vorschlag wird geprüft…':controller.uncertain?'Anfrage erneut prüfen':'Vorschlag speichern'} disabled={controller.busy||(!controller.uncertain&&(controller.locked||controller.orderChanged||!!controller.issue||!controller.sourceId||controller.reason.trim().length<10))} onPress={controller.submit}/>:null}<PremiumButton title="Entwurf schließen" variant="secondary" disabled={controller.busy||controller.uncertain} onPress={controller.close}/></View>
   </View>:null}
   <View style={styles.history}><Text style={styles.heading}>Gespeicherter Fassungsverlauf</Text>{workspace&&!workspace.items.length?<Text style={styles.note}>Keine strukturierten Übertragungsvorschläge im vollständig geladenen Verlauf.</Text>:null}
    {workspace?.items.map(item=>{const record=item as unknown as Row,application=record.application as Row|null|undefined,proposed=record.proposed_order as Row|undefined,before=record.before_snapshot as Row|undefined,sourceSnapshot=record.source_snapshot as Row|undefined,documentSnapshot=sourceSnapshot?.document_snapshot as Row|undefined,open=expanded===item.id;return <View key={item.id} style={styles.record}>
      <View style={styles.recordHeader}><Text style={styles.label}>{time(record.recorded_at??record.created_at)}</Text><PremiumBadge label={record.state==='transcribed'?'Technisch übertragen':'Vorschlag · Prüfung offen'} variant={record.state==='transcribed'?'green':'orange'}/></View>
      <Text style={styles.bodyText}>{display(record.reason)}</Text><Text style={styles.note}>Erfasst durch {display(record.recorded_by_name)} · Ausgangsstand {time(record.expected_updated_at)}</Text><Text style={styles.note}>Archivierte Quelle: {display(documentSnapshot?.title)} · {display(documentSnapshot?.file_name)} · Dokumentstand {time(documentSnapshot?.updated_at)}</Text><Text style={styles.note}>{record.state==='transcribed'?'Die technische Übernahme ist mit dem ursprünglichen und dem neuen nativen Stand dokumentiert. Eine ärztliche Freigabe folgt daraus nicht.':'Die aktive Verordnung bleibt unverändert. Eine technische Übernahme wurde für diesen Vorschlag nicht nachgewiesen.'}</Text>
      <PremiumButton title={open?'Originale schließen':'Originale vergleichen'} variant="secondary" onPress={()=>setExpanded(open?null:item.id)}/>
      {open?<View style={styles.comparison}>{orderFields.map(field=><View key={field.key} style={styles.comparisonRow}><Text style={styles.label}>{field.label}</Text><View style={styles.fields}><View style={styles.field}><Text style={styles.note}>Ursprünglicher Stand</Text><Text style={styles.bodyText}>{display(before?.[field.native])}</Text></View><View style={styles.field}><Text style={styles.note}>Vorgeschlagene Übertragung</Text><Text style={styles.bodyText}>{display(proposed?.[field.key])}</Text></View>{application?<View style={styles.field}><Text style={styles.note}>Technisch gespeicherter Stand</Text><Text style={styles.bodyText}>{display((application.after_snapshot as Row|undefined)?.[field.native])}</Text></View>:null}</View></View>)}{application?<Text style={styles.note}>Technische Übernahme: {time(application.recorded_at)} · {display(application.reason)}</Text>:null}</View>:null}
    </View>;})}
   </View>
  </View>
 </SectionPanel>;
}
function useRevisionStyles(){const {c}=useCareLightPalette();return useMemo(()=>StyleSheet.create({
 body:{gap:spacing.md,minWidth:0},bodyText:{...typography.body,color:c.text},note:{...typography.caption,color:c.muted},label:{...typography.label,color:c.text},heading:{...typography.bodyStrong,color:c.text},
 fields:{flexDirection:'row',flexWrap:'wrap',gap:spacing.md,minWidth:0},field:{flexGrow:1,flexBasis:220,minWidth:0},fullField:{width:'100%',minWidth:0},actions:{flexDirection:'row',flexWrap:'wrap',gap:spacing.sm,minWidth:0},
 editor:{borderWidth:1,borderColor:c.border,borderRadius:16,padding:spacing.md,gap:spacing.md,minWidth:0},history:{gap:spacing.md,minWidth:0},record:{borderTopWidth:1,borderTopColor:c.border,paddingTop:spacing.md,gap:spacing.sm,minWidth:0},recordHeader:{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',gap:spacing.sm,minWidth:0},comparison:{gap:spacing.md,minWidth:0},comparisonRow:{borderTopWidth:1,borderTopColor:c.border,paddingTop:spacing.sm,gap:spacing.sm,minWidth:0},
}),[c]);}
