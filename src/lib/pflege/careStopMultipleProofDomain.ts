import { calculateTariffAmount, type CareTariff, type FundingBasis } from './ambulatoryOperationsDomain';
import type { CareStopProofLineInput } from './ambulatoryOperationsService';

export function buildCareStopProofLine(tariff: CareTariff | undefined, basis: FundingBasis, quantityValue: string, orderIdValue: string, executionValue: string, deviationValue: string): { ok: true; line: CareStopProofLineInput; amountCents: number } | { ok: false; error: string } {
  const quantity=quantityValue.trim().replace(',','.'),orderId=orderIdValue.trim(),executionDetail=executionValue.trim(),deviation=deviationValue.trim();
  const amountCents=tariff?calculateTariffAmount(tariff,quantity):null;
  if(!tariff||amountCents==null)return{ok:false,error:'Gültigen Tarif und eine positive Menge mit höchstens drei Nachkommastellen auswählen.'};
  if(basis==='sgb_v'&&!orderId)return{ok:false,error:'Diese SGB-V-Position benötigt eine gültige Verordnung.'};
  if(basis!=='sgb_v'&&orderId)return{ok:false,error:'Ein Verordnungsbezug ist nur für die SGB-V-Position zulässig.'};
  if(executionDetail.length<5||executionDetail.length>4000)return{ok:false,error:'Die tatsächliche Durchführung der Position muss zwischen 5 und 4000 Zeichen enthalten.'};
  if(deviation.length>2000)return{ok:false,error:'Die Abweichung darf höchstens 2000 Zeichen enthalten.'};
  return{ok:true,line:{tariffId:tariff.id,quantity,orderId,executionDetail,deviation},amountCents};
}

export function validateCareStopProofLines(lines: readonly CareStopProofLineInput[]): string | null {
  if(lines.length<2||lines.length>50)return'Für einen Mehrfachnachweis sind zwei bis fünfzig getrennte Positionen erforderlich.';
  const keys=new Set<string>();
  for(const line of lines){const key=`${line.tariffId}:${line.orderId}`;if(keys.has(key))return'Gleicher Tarif und Verordnungsbezug dürfen nicht als doppelte Position gespeichert werden.';keys.add(key);}
  return null;
}
