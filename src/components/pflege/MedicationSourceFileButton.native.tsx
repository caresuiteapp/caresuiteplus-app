import {shareNativeFile} from '@/lib/platform/nativeFileDelivery.native';
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
      await shareNativeFile(new Uint8Array(await result.data.blob.arrayBuffer()),result.data.fileName,result.data.blob.type||'application/octet-stream');if(!isCurrent())return;setRequested(result.data.fingerprintVerified?'Die Quelldatei wurde an die Android-Dateiauswahl übergeben. Der Inhalt stimmt mit dem gespeicherten Fingerabdruck überein. Bitte die Datei fachlich prüfen.':'Die Quelldatei wurde an die Android-Dateiauswahl übergeben. Für diese historische Zuordnung fehlt der Inhaltsfingerabdruck. Der damalige Dateiinhalt ist nicht bestätigt.');
    }catch{if(isCurrent())setError('Die Datei konnte nicht an Android übergeben werden. Bitte erneut versuchen.');}
    finally{flight.current=false;if(isCurrent())setBusy(false);}
  };
  return <View style={{gap:8}}>
    <PremiumButton title={busy?'Quelldatei wird geladen…':'Quelldatei herunterladen'} variant="secondary" disabled={busy} onPress={download} />
    {error?<ErrorState message={error} />:null}
    {requested?<SuccessState message={requested} />:null}
  </View>;
}
