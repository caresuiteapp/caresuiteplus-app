export type CareProofSignerKind = 'client' | 'representative';
export type CareProofClientConfirmationInput = Readonly<{
  proofId: string; expectedProofUpdatedAt: string; signerKind: CareProofSignerKind; signerName: string;
  representationBasis: string; pngDataUrl: string; requestId: string;
}>;

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const timestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;
const png = /^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/=]+$/;

export function buildCareProofClientConfirmation(input: CareProofClientConfirmationInput): { ok: true; value: CareProofClientConfirmationInput } | { ok: false; error: string } {
  const value={...input,proofId:input.proofId.trim(),expectedProofUpdatedAt:input.expectedProofUpdatedAt.trim(),signerName:input.signerName.trim(),representationBasis:input.representationBasis.trim(),pngDataUrl:input.pngDataUrl.trim(),requestId:input.requestId.trim()};
  if(!uuid.test(value.proofId)||!uuid.test(value.requestId))return{ok:false,error:'Nachweis- und Anfragekennung sind ungültig.'};
  if(!timestamp.test(value.expectedProofUpdatedAt))return{ok:false,error:'Die unveränderte Nachweisfassung muss neu geladen werden.'};
  if(!['client','representative'].includes(value.signerKind))return{ok:false,error:'Bestätigende Person auswählen.'};
  if(value.signerName.length<2||value.signerName.length>200)return{ok:false,error:'Der Name muss zwischen 2 und 200 Zeichen enthalten.'};
  if(value.signerKind==='client'&&value.representationBasis)return{ok:false,error:'Bei eigener Bestätigung darf keine Vertretungsgrundlage eingetragen sein.'};
  if(value.signerKind==='representative'&&(value.representationBasis.length<3||value.representationBasis.length>1000))return{ok:false,error:'Für die Vertretung ist eine konkrete Grundlage mit 3 bis 1000 Zeichen erforderlich.'};
  if(!png.test(value.pngDataUrl)||value.pngDataUrl.length<100||value.pngDataUrl.length>1048576)return{ok:false,error:'Eine gültige PNG-Unterschrift ist erforderlich.'};
  return{ok:true,value};
}

