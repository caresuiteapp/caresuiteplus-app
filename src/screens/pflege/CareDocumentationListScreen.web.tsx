import {useEffect,useMemo,useRef,useState} from 'react';
import {ScrollView,Text,View} from 'react-native';
import {useLocalSearchParams,useRouter} from 'expo-router';
import {ScreenShell} from '@/components/layout';
import {EmptyState,ErrorState,FilterChipGroup,InfoBanner,LoadingState,PremiumButton,PremiumInput,SectionPanel} from '@/components/ui';
import {useAsyncQuery} from '@/hooks/core/useAsyncQuery';
import {useCareRuntimePermissions} from '@/hooks/pflege/useCareRuntimePermissions.web';
import {useAuth} from '@/lib/auth/context';
import {fetchEligibleCareClients} from '@/lib/careAssessment';
import {CareDocumentationPathWorkspace} from '@/components/pflege/CareDocumentationPathWorkspace.web';
import {readCareDocumentation} from '@/lib/pflege/careDocumentationRepository.supabase.web';
import type {CareDocumentationKind} from '@/lib/pflege/careDocumentationPacket.web';
import {colors,spacing,typography} from '@/theme';

const names:Record<CareDocumentationKind,string>={care_report:'Pflegebericht',planned_service:'Geplante Leistung',refusal:'Ablehnung',incident:'Besonderes Ereignis',structured_protocol:'Strukturiertes Protokoll',control:'Kontrollauftrag',external:'Fremddokumentation'};
export function CareDocumentationListScreen(){
 const router=useRouter(),params=useLocalSearchParams<{clientId?:string}>(),permissions=useCareRuntimePermissions(),{profile}=useAuth(),tenantId=permissions.tenantId??'',actorId=profile?.id??'';const alive=useRef(true);useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const clients=useAsyncQuery(()=>tenantId?fetchEligibleCareClients(tenantId,permissions.roleKey):Promise.resolve({ok:false as const,error:'Kein Mandant.'}),[tenantId,permissions.roleKey],{enabled:!!tenantId&&!!actorId});
 const [chosen,setChosen]=useState(''),clientId=(typeof params.clientId==='string'&&params.clientId)||chosen;
 const documents=useAsyncQuery(()=>readCareDocumentation({tenantId,clientId:clientId||null,actorId,isCurrent:()=>alive.current&&permissions.can('pflege.documentation.view')}),[tenantId,clientId,actorId,permissions.permissions.join('|')],{enabled:!!tenantId&&!!clientId&&!!actorId});
 const [kind,setKind]=useState('all'),[term,setTerm]=useState(''),[from,setFrom]=useState(''),[to,setTo]=useState('');
 const options=useMemo(()=>(clients.data??[]).map(client=>({key:client.id,label:`${client.lastName}, ${client.firstName}`})),[clients.data]);
 const rows=useMemo(()=>(documents.data??[]).filter(row=>(kind==='all'||row.kind===kind)&&(!term.trim()||JSON.stringify(row.payload).toLocaleLowerCase('de-DE').includes(term.trim().toLocaleLowerCase('de-DE')))&&(!from||row.occurredAt>=from)&&(!to||row.occurredAt<=to)).sort((a,b)=>b.occurredAt.localeCompare(a.occurredAt)||b.id.localeCompare(a.id)),[documents.data,kind,term,from,to]);
 return <ScreenShell title="Pflegedokumentation" subtitle="Vollständiger Verlauf mit Originalen, Nachträgen und Bestätigungen" scroll={false} rightSlot={permissions.can('pflege.documentation.create')?<PremiumButton title="+ Neuer Vorgang" size="sm" onPress={()=>router.push('/pflege/berichte/new' as never)}/>:undefined}>
  <ScrollView contentContainerStyle={{gap:spacing.md,paddingBottom:spacing.xxl}}>
   {permissions.loading?<LoadingState message="Aktuelle Leserechte werden bestätigt…"/>:permissions.error?<ErrorState message={permissions.error} onRetry={permissions.refreshPermissions}/>:null}
   {clients.loading?<LoadingState message="Aktive Pflegefälle werden geladen…"/>:clients.error?<ErrorState message={clients.error} onRetry={clients.refresh}/>:<FilterChipGroup wrap options={options} value={clientId} onChange={setChosen}/>} 
   {clientId?<CareDocumentationPathWorkspace clientId={clientId}/>:null}
   {clientId?<SectionPanel title="Filtern und ausgeben" subtitle={`${documents.data?.length??0} vollständig geladene aktuelle Fassung(en)`}><FilterChipGroup wrap options={[{key:'all',label:'Alle'},...Object.entries(names).map(([key,label])=>({key,label}))]} value={kind} onChange={setKind}/><PremiumInput label="Volltextfilter" value={term} onChangeText={setTerm}/><View style={{flexDirection:'row',gap:spacing.sm,flexWrap:'wrap'}}><View style={{flex:1,minWidth:220}}><PremiumInput label="Ereignisse ab (ISO)" value={from} onChangeText={setFrom}/></View><View style={{flex:1,minWidth:220}}><PremiumInput label="Ereignisse bis (ISO)" value={to} onChangeText={setTo}/></View></View><PremiumButton title="Gefilterten vollständigen Verlauf drucken" variant="secondary" onPress={()=>globalThis.window?.print()}/></SectionPanel>:null}
   {documents.loading?<LoadingState message="Alle Dokumentationsseiten bis zur leeren Folgeseite werden geladen…"/>:documents.error?<ErrorState message={documents.error} onRetry={documents.refresh}/>:clientId&&rows.length===0?<EmptyState title="Keine passenden Einträge" message="Es wurden keine Einträge im vollständig gelesenen Bestand gefunden."/>:null}
   {documents.refreshError?<ErrorState message={documents.refreshError} onRetry={documents.refresh}/>:null}
   {rows.map(row=><SectionPanel key={row.id} title={row.payload.title} subtitle={`${names[row.kind]} · Ereignis ${row.occurredAt}`}><Text style={{...typography.body}}>{row.payload.observation}</Text><Text style={{...typography.caption,color:colors.textMuted}}>Revision {row.revision} · erfasst {row.recordedAt} durch {row.recordedByName}{row.signature?' · bestätigt':' · nicht bestätigt'}</Text>{row.kind==='external'?<InfoBanner variant="info" message="Externer Befund; keine eigene Durchführung."/>:row.kind==='refusal'?<InfoBanner variant="warning" message="Ablehnung; kein positiver Durchführungsnachweis."/>:null}<PremiumButton title="Original, Nachträge und Bestätigung öffnen" variant="secondary" onPress={()=>router.push(`/pflege/dokumentation/${row.id}?clientId=${clientId}` as never)}/></SectionPanel>)}
  </ScrollView>
 </ScreenShell>;
}
