import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { ErrorState, PremiumButton, SuccessState } from '@/components/ui';
import { fetchMedicationSourceFile, type MedicationDocumentation } from '@/lib/pflege/medicationAdministrationService';
import type { RoleKey } from '@/types';

export function MedicationSourceFileButton({ order, linkId, tenantId, role }: { order:MedicationDocumentation;linkId:string;tenantId:string;role:RoleKey|null }) {
  const [busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),[requested,setRequested]=useState<string|null>(null);
  const active=useRef(true),flight=useRef(false),generation=useRef(0);
  useEffect(()=>{active.current=true;return()=>{active.current=false;generation.current+=1;};},[]);
  const download=async()=>{
    if(flight.current)return;flight.current=true;setBusy(true);setError(null);setRequested(null);
    const requestGeneration=generation.current;
    const isCurrent=()=>active.current&&generation.current===requestGeneration;
    try {
      const result=await fetchMedicationSourceFile(order,linkId,tenantId,role,isCurrent);
      if(!isCurrent())return;
      if(!result.ok){setError(result.error);return;}
      const url=URL.createObjectURL(result.data.blob),anchor=document.createElement('a');
      try {
        anchor.href=url;anchor.download=result.data.fileName;anchor.rel='noopener noreferrer';
        document.body.appendChild(anchor);anchor.click();setRequested(result.data.origin==='archive'?'Download der Archivkopie beim Browser angefordert. Ihr Inhalt stimmt mit dem gespeicherten Fingerabdruck überein. Bitte die Datei öffnen und fachlich prüfen.':result.data.fingerprintVerified?'Download beim Browser angefordert. Der Dateiinhalt stimmt mit dem beim Zuordnen erfassten Fingerabdruck überein. Bitte die Datei öffnen und fachlich prüfen.':'Download beim Browser angefordert. Für diese historische Zuordnung fehlt der Inhaltsfingerabdruck. Der damalige Dateiinhalt ist nicht bestätigt.');
      }finally{
        anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),30_000);
      }
    }catch{if(isCurrent())setError('Der Browser konnte den Download nicht starten. Bitte erneut versuchen.');}
    finally{flight.current=false;if(isCurrent())setBusy(false);}
  };
  return <View style={{gap:8}}>
    <PremiumButton title={busy?'Quelldatei wird geladen…':'Quelldatei herunterladen'} variant="secondary" disabled={busy} onPress={download} />
    {error?<ErrorState message={error} />:null}
    {requested?<SuccessState message={requested} />:null}
  </View>;
}
