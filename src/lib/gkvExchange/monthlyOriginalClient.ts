import {readMonthlyOriginalCommand,readMonthlyOriginalResponse,monthlyBase64,MONTHLY_WIRE_LIMIT,type MonthlyOriginalCommand} from './monthlyOriginalContract';
const messages: Record<string,string> = {
  MONTHLY_AUTH:'Bitte erneut anmelden. Die Erfassung ist an Ihre persönliche Anmeldung gebunden.',
  MONTHLY_FORBIDDEN:'Für diese Erfassung fehlt die aktuelle Beauftragung oder Hostfreigabe.',
  MONTHLY_UNCONFIGURED:'Die Verbindung für Monatsunterschriften ist noch nicht eingerichtet.',
  MONTHLY_STALE:'Fassung oder Anmeldung haben sich geändert. Bitte den Vorgang prüfen und den Monatsnachweis neu laden.',
  MONTHLY_SIGNATURE_REUSED:'Dieses Unterschriftsbild wurde bereits verwendet. Für diese Fassung ist eine neue persönliche Unterschrift erforderlich.',
  MONTHLY_INPUT:'Die Unterschrift oder der Erfassungsauftrag konnte nicht geprüft werden.',
  MONTHLY_FILE_SIZE:'Diese Datei überschreitet die unterstützte Größe von 2 MiB.',
  MONTHLY_QUOTA:'Das Archiv hat seine Speichergrenze erreicht. Bitte die Administration informieren.',
  MONTHLY_BUSY:'Der Host bearbeitet gerade einen Vorgang. Bitte den Status später erneut prüfen.',
};
export async function monthlySha256(bytes: Uint8Array): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(bytes)))].map(b=>b.toString(16).padStart(2,'0')).join('');
}
/** No automatic retry. Identity comes from the current authenticated repository
 * session; the gateway and host independently check the personal token. */
export async function postMonthlyOriginalCommand(command: MonthlyOriginalCommand, token: string, actorId: string, signal?: AbortSignal, http: typeof fetch = fetch) {
  const input=readMonthlyOriginalCommand(command);
  const response=await http('/api/gkv/monthly-originals',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
    body:JSON.stringify(input),redirect:'error',cache:'no-store',signal});
  const reader=response.body?.getReader(); if(!reader)throw Error('Die Antwort fehlt. Bitte den Erfassungsstatus prüfen.');
  let size=0;const chunks:Uint8Array[]=[];
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MONTHLY_WIRE_LIMIT){await reader.cancel();throw Error('Die Antwort ist zu groß. Bitte den Erfassungsstatus prüfen.');}chunks.push(value);}}
  finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let at=0;for(const part of chunks){bytes.set(part,at);at+=part.length;}
  let value;try{value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw Error('Die Antwort ist unlesbar. Bitte den Erfassungsstatus prüfen.');}
  if(!response.ok)throw Error(messages[value?.error] || 'Die Verbindung wurde nicht bestätigt. Bitte zuerst den Erfassungsstatus prüfen.');
  const result=readMonthlyOriginalResponse(value,input,actorId);
  if(result.kind==='original' && await monthlySha256(monthlyBase64(result.pdfBase64))!==result.original.originalSha256)throw Error('Die Originaldatei stimmt nicht mit dem Prüfbeleg überein.');
  return result;
}
