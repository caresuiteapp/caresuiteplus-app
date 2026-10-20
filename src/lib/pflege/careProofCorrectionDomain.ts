export type CareProofCorrectionInput=Readonly<{proofId:string;expectedProofUpdatedAt:string;reason:string;performanceNote:string;deviations:string;requestId:string}>;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const timestamp=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;
export function buildCareProofCorrection(input:CareProofCorrectionInput,original?:Readonly<{performanceNote:string;deviations:string}>):{ok:true;value:CareProofCorrectionInput}|{ok:false;error:string}{
 const value={...input,proofId:input.proofId.trim(),expectedProofUpdatedAt:input.expectedProofUpdatedAt.trim(),reason:input.reason.trim(),performanceNote:input.performanceNote.trim(),deviations:input.deviations.trim(),requestId:input.requestId.trim()};
 if(!uuid.test(value.proofId)||!uuid.test(value.requestId))return{ok:false,error:'Nachweis- und Anfragekennung sind ungültig.'};
 if(!timestamp.test(value.expectedProofUpdatedAt))return{ok:false,error:'Die unveränderte Ausgangsfassung muss neu geladen werden.'};
 if(value.reason.length<10||value.reason.length>2000)return{ok:false,error:'Der konkrete Korrekturgrund muss 10 bis 2000 Zeichen enthalten.'};
 if(value.performanceNote.length<5||value.performanceNote.length>4000)return{ok:false,error:'Der korrigierte Durchführungsnachweis muss 5 bis 4000 Zeichen enthalten.'};
 if(value.deviations.length>2000)return{ok:false,error:'Abweichungen dürfen höchstens 2000 Zeichen enthalten.'};
 if(original&&value.performanceNote===original.performanceNote&&value.deviations===original.deviations)return{ok:false,error:'Die neue Fassung muss sich vom Original unterscheiden.'};
 return{ok:true,value};
}
