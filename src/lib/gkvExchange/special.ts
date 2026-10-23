import { billingDay, isDate, type BillingCase, type ExchangeDraft, type Issue, type ServiceLine } from './model';
import { daysInMonth } from './care';

/** TA1 6.4.0 HIL; TA3 6.4.0 §§2.7.4, 2.8, 2.9, 2.12. */
export const AID_SUPPLY_CODES = {
  '00':'Neulieferung', '01':'Reparatur', '02':'Wiedereinsatz', '03':'Miete', '04':'Nachlieferung',
  '05':'Zurichtung', '06':'Höherwertiges Pflegehilfsmittel', '08':'Vergütungspauschale',
  '09':'Folgevergütungspauschale', '10':'Folgeversorgung', '11':'Ersatzbeschaffung', '12':'Zubehör',
  '13':'Reparaturpauschale', '14':'Wartung', '15':'Wartungspauschale', '16':'Auslieferung',
  '17':'Aussonderung', '18':'Rückholung', '19':'Abbruch', '20':'Erprobung', '21':'Miete (Quartal)', '22':'Miete (Tag)',
} as const;
export type AidDetails = {
  kind: string; vatTreatment: string; vatCode: string; coPaymentCents: number;
  approvalReference: string; approvalDate: string; supplyCode: string; description: string;
  productCode: string; inventoryNumber: string; productCodeRequired: boolean; inventoryRequired: boolean;
};
export type SpecialAgreement = { reference: string; from: string; until: string; exchangeReference: string; limitCents: number };
export const SPECIAL_SERVICES = ['08','11','12','14'] as const;
export const isSpecialService = (service: string) => (SPECIAL_SERVICES as readonly string[]).includes(service);
export const emptyAid = (): AidDetails => ({ kind:'',vatTreatment:'',vatCode:'',coPaymentCents:0,approvalReference:'',approvalDate:'',supplyCode:'',description:'',productCode:'',inventoryNumber:'',productCodeRequired:false,inventoryRequired:false });
const object = (v: unknown): v is Record<string,unknown> => Boolean(v && typeof v === 'object' && !Array.isArray(v));
const money = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) >= 0 && Number(v) <= 999999999999;
export function hasAidShape(v: unknown): v is AidDetails {
  return object(v) && ['kind','vatTreatment','vatCode','approvalReference','approvalDate','supplyCode','description','productCode','inventoryNumber'].every(k=>typeof v[k]==='string')
    && money(v.coPaymentCents) && typeof v.productCodeRequired==='boolean' && typeof v.inventoryRequired==='boolean';
}
export function hasAgreementShape(v: unknown): v is SpecialAgreement {
  return object(v) && ['reference','from','until','exchangeReference'].every(k=>typeof v[k]==='string') && money(v.limitCents);
}
const rounded = (n: bigint, d: bigint) => (n * 2n + d) / (d * 2n);
/** Explicit tax treatment. No tax category is inferred from a product name. Whole delivery units only. */
export function aidAmounts(l: ServiceLine) {
  const a=l.aid;
  if(!hasAidShape(a) || !money(l.unitPriceCents) || !Number.isInteger(l.quantityHundredths) || l.quantityHundredths<100 || l.quantityHundredths>999900 || l.quantityHundredths%100)
    throw new Error('Pflegehilfsmittel mit vollständigen Angaben und ganzer Liefermenge erfassen.');
  if(!['exempt','included','add'].includes(a.vatTreatment) || (a.vatTreatment!=='exempt' && !['1','2'].includes(a.vatCode)) || (a.vatTreatment==='exempt' && a.vatCode))
    throw new Error('Steuerbehandlung und zutreffenden Steuersatz ausdrücklich auswählen.');
  const price=BigInt(l.unitPriceCents), count=BigInt(l.quantityHundredths/100), rate=a.vatCode==='1'?19n:7n;
  const unitVat=a.vatTreatment==='exempt'?0n:a.vatTreatment==='add'?rounded(price*rate,100n):price-rounded(price*100n,100n+rate);
  const unitNet=a.vatTreatment==='included'?price-unitVat:price;
  const net=unitNet*count, vat=unitVat*count, gross=net+vat;
  if(gross>999999999999n)throw new Error('Hilfsmittelbetrag überschreitet die Feldlänge.');
  return {netCents:Number(net),vatCents:Number(vat),totalCents:Number(gross),vatUnitCents:Number(unitVat),vatRate:a.vatTreatment==='exempt'?0:Number(rate)};
}
export function aidIssues(l: ServiceLine, d: ExchangeDraft, invoiceDate: string): Issue[] {
  const out:Issue[]=[];const add=(path:string,message:string)=>out.push({path,message,severity:'error'});
  if(d.serviceType!=='06' && l.remuneration!=='05') { if(l.aid!==undefined)add('aid','Hilfsmittelangaben sind nur bei Leistungsart 06 und Vergütungsart 05 zulässig.');return out; }
  if(d.serviceType!=='06'||l.remuneration!=='05')add('remuneration','Pflegehilfsmittel benötigen Leistungsart 06 und Vergütungsart 05.');
  const a=l.aid;if(!hasAidShape(a)){add('aid','Hilfsmittelart, Steuerbehandlung, Zuzahlung und Lieferangaben ergänzen.');return out;}
  if(!['technical','consumable'].includes(a.kind))add('aid.kind','Technisches oder zum Verbrauch bestimmtes Pflegehilfsmittel auswählen.');
  if(!/^(\d{2}|\d{10})$/.test(l.code))add('code','Positionsnummer aus dem aktuellen Verzeichnis: zehn Stellen; ohne vergebene Nummer nur die zweistellige Produktgruppe.');
  const field=(key:keyof AidDetails,max:number,required=false)=>{const v=a[key];if(typeof v!=='string'||v.length>max||/[^\x20-\x7e\xa0-\xff]/.test(v)||(required&&!v.trim()))add(`aid.${key}`,`Angabe mit höchstens ${max} ISO-8859-1-Zeichen erforderlich.`);};
  field('description',30,l.code.length===2);if(l.code.length===10&&a.description)add('aid.description','Bezeichnung nur verwenden, solange keine vollständige Positionsnummer vergeben ist.');
  field('approvalReference',15,a.kind==='technical');field('inventoryNumber',20,a.inventoryRequired||a.supplyCode==='02');
  field('productCode',10,a.productCodeRequired);
  if(a.productCode&&!/^\d{1,10}$/.test(a.productCode))add('aid.productCode','Vertragliche Produktbesonderheit muss numerisch sein.');
  if(a.supplyCode&&!Object.hasOwn(AID_SUPPLY_CODES,a.supplyCode)||a.kind==='technical'&&!a.supplyCode)add('aid.supplyCode','Gültiges Lieferkennzeichen erforderlich; reservierte Schlüssel sind unzulässig.');
  if(a.approvalDate&&(!isDate(a.approvalDate)||a.approvalDate>invoiceDate||!a.approvalReference))add('aid.approvalDate','Genehmigungsdatum und Genehmigungskennzeichen müssen zusammenpassen.');
  if(!l.contractReference?.trim()||l.contractReference.length>200)add('contractReference','Liefervertrag mit Preis-, Steuer- und Rundungsregel angeben.');
  if(l.pointValue||l.points||l.pricingRule||l.adjustments?.length)add('aid','Punktwerte und Zuschläge sind in diesem Hilfsmittelprofil nicht vorgesehen.');
  if(d.profile.taxTreatment==='taxable' ? a.vatTreatment==='exempt' : a.vatTreatment!=='exempt')add('aid.vatTreatment','Steuerbehandlung der Position muss zum Abrechnungsprofil passen.');
  try {const amounts=aidAmounts(l);if(a.coPaymentCents>amounts.totalCents)add('aid.coPaymentCents','Zuzahlung übersteigt den Positionsbetrag.');}catch(e){add('aid',e instanceof Error?e.message:'Hilfsmittelbetrag prüfen.');}
  return out;
}
/** Application policy: every special case needs its actual award/contract and exchange agreement. */
export function specialCaseIssues(c:BillingCase,d:ExchangeDraft):Issue[] {
  const out:Issue[]=[];const add=(path:string,message:string)=>out.push({path,message,severity:'error'});
  if(d.serviceType==='06') {
    if(!['11','15','16','17','19'].includes(d.profile.billingCode))add('agreement','Aktueller Abrechnungscode eines Pflegehilfsmittellieferanten erforderlich.');
    if(c.lines.every(l=>hasAidShape(l.aid))&&c.lines.reduce((s,l)=>s+l.aid!.coPaymentCents,0)!==c.coPaymentCents)add('coPaymentCents','Fallzuzahlung muss der Summe der HIL-Zuzahlungen entsprechen.');
  }
  if(!isSpecialService(d.serviceType)) { if(c.agreement)add('agreement','Bewilligungsprofil gehört zu Leistungsart 08, 11, 12 oder 14.');return out; }
  const a=c.agreement;
  if(!hasAgreementShape(a)){add('agreement','Bewilligung beziehungsweise Vertrag, Gültigkeit, Höchstbetrag und Vereinbarung zum Datenaustausch ergänzen.');return out;}
  for(const key of ['reference','exchangeReference'] as const)if(!a[key].trim()||a[key].length>200)add(`agreement.${key}`,'Nachvollziehbare Referenz mit höchstens 200 Zeichen erforderlich.');
  if(!isDate(a.from)||!isDate(a.until)||a.from>a.until)add('agreement.from','Gültigen Bewilligungs-/Vertragszeitraum angeben.');
  if(a.limitCents<=0||c.grossCents-c.coPaymentCents-c.aidCents>a.limitCents)add('agreement.limitCents','Kassenanteil überschreitet den für diesen Fall bestätigten Betrag oder dieser fehlt.');
  for(const [i,l] of c.lines.entries()){
    const monthly=l.pricingRule==='special_monthly';
    const allowed=d.serviceType==='11'?['01','02','99']:['99'];
    if(!allowed.includes(l.remuneration))add(`lines.${i}.remuneration`,'Für dieses Sonderprofil sind Einzelbeträge ohne Vertragspreisregelung verfügbar; beim Beratungsgutschein zusätzlich Leistungskomplexe und Zeitvergütung.');
    if(l.remuneration!=='99'&&!l.contractReference?.trim())add(`lines.${i}.contractReference`,'Vertrag für diese Vergütungsart angeben.');
    if(monthly&&(d.serviceType==='11'||l.remuneration!=='99'||l.day!=='99'||l.quantityHundredths!==100||l.duration!=='00'))add(`lines.${i}.pricingRule`,'Feste Sonderpauschale: vollständiger Monat, Menge 1, ohne Vertragspreisregelung; nicht für Beratungsgutscheine.');
    const start=`${c.month}-${monthly?'01':l.day}`,end=monthly?`${c.month}-${daysInMonth(c.month)}`:start;
    if(monthly&&c.lines.length!==1)add(`lines.${i}.pricingRule`,'Feste Sonderpauschale als einzelnen Abrechnungsfall erfassen.');
    if(!isDate(start)||!isDate(end)||start<a.from||end>a.until||end>c.invoiceDate||end>billingDay(d.createdAt))add(`lines.${i}.day`,'Leistungszeitraum muss durch Bewilligung/Vertrag gedeckt und vor der Abrechnung abgeschlossen sein.');
  }
  return out;
}
