import { parseEdifact, validateEnvelope, type Segment } from './edifact';
import { isDate, isIk, type ServiceType } from './model';

export type CarrierLink = { kind: string; ik: string; providerGroup: string; billingCentre: string;
  delivery: string; medium: string; state: string; district: string; service: string; from?: string; until?: string };
type Validity = { from?: string; until?: string };
export type CarrierAddress = { protocol: string; address: string; medium: string; charset: string; from?: string; until?: string; mediumValidity?: Validity };
export type Carrier = { ik: string; name: string; from?: string; until?: string; deleted: boolean;
  links: CarrierLink[]; addresses: CarrierAddress[]; raw: Segment[] };
export type CarrierDirectory = { fileName: string; importedAt: string; records: Carrier[] };
const get = (s: Segment, field: number) => s[field]?.[0] || '';
function date(value: string): string | undefined {
  if (!value || value === '00000000' || value === '99999999') return undefined;
  const result = `${value.slice(0,4)}-${value.slice(4,6)}-${value.slice(6,8)}`;
  if (!/^\d{8}$/.test(value) || !isDate(result)) throw new Error('Ungültiger Gültigkeitszeitraum in der Kostenträgerdatei.');
  return result;
}
/** Full imports are snapshots; FKT=03 records are retained as deletions, never as active routes. */
export function parseCarrierDirectory(source: string, fileName: string, now = new Date().toISOString()): CarrierDirectory {
  if (!/^(AO|BK|BN|EK|IK|LK|SE)/i.test(fileName)) throw new Error('Die Kassenart muss am amtlichen Dateinamen erkennbar sein.');
  const segments = parseEdifact(source); validateEnvelope(segments,['KOTR']);
  const records: Carrier[] = []; const seen = new Set<string>(); let current: Carrier | null = null;
  let validityTarget: Validity | null = null; let mediumValidity: Validity = {}; let medium = '', charset = ''; let hasFunction = false;
  for (const s of segments.slice(1,-1)) {
    const tag = get(s,0);
    if (tag === 'UNH') {
      if (!['1','01','2','02'].includes(get(s,2) === 'KOTR' ? s[2]?.[1] : '')) throw new Error('Nicht unterstützte Kostenträgerdatei-Version.');
      current = {ik:'',name:'',deleted:false,links:[],addresses:[],raw:[]}; medium=''; charset=''; hasFunction=false; validityTarget=null; mediumValidity={};
    } else if (tag === 'UNT') {
      if (!current || !isIk(current.ik) || !current.name || !current.from || !hasFunction || seen.has(current.ik)) throw new Error('Kostenträger fehlt, ist unvollständig oder doppelt.');
      if (current.from && current.until && current.from > current.until) throw new Error('Gültigkeitszeitraum ist vertauscht.');
      seen.add(current.ik); records.push(current); current=null; validityTarget=null;
    } else if (current) {
      current.raw.push(s);
      if (tag === 'IDK') { if(current.ik)throw new Error('Mehrere IDK-Segmente in einer Nachricht.'); current.ik=get(s,1); current.name=get(s,3); validityTarget=current; }
      else if (tag === 'VDT') {
        if (!validityTarget) throw new Error('Gültigkeit kann keinem Segment zugeordnet werden.');
        validityTarget.from=date(get(s,1)); validityTarget.until=date(get(s,2));
        if (validityTarget.from && validityTarget.until && validityTarget.from > validityTarget.until) throw new Error('Ungültige Segmentgültigkeit.');
      } else if (tag === 'FKT') {
        if (!['01','02','03','04'].includes(get(s,1))) throw new Error('Unbekannte Funktion in Kostenträgerdatei.');
        if(hasFunction)throw new Error('Mehrere FKT-Segmente in einer Nachricht.');
        hasFunction=true; current.deleted=get(s,1)==='03'; validityTarget={};
      } else if (tag === 'NAM') { current.name=s.slice(2).map(p=>p.join(':')).filter(Boolean).join(' ') || current.name; validityTarget={}; }
      else if (tag === 'VKG') {
        const link: CarrierLink={kind:get(s,1),ik:get(s,2),providerGroup:get(s,3),billingCentre:get(s,4),delivery:get(s,5),medium:get(s,6),state:get(s,7),district:get(s,8),service:get(s,9)};
        if (link.kind!=='00' && !isIk(link.ik)) throw new Error('Ein Routingverweis enthält kein gültiges IK.');
        current.links.push(link); validityTarget=link;
      } else if (tag === 'UEM') { medium=get(s,1); charset=get(s,3); mediumValidity={}; validityTarget=mediumValidity; }
      else if (tag === 'DFU') {
        if (!medium) throw new Error('Übermittlungsmedium vor DFU fehlt.');
        const address: CarrierAddress={protocol:get(s,2),address:get(s,7),medium,charset,mediumValidity};
        if (!address.address) throw new Error('Empfängeradresse fehlt.');
        current.addresses.push(address); validityTarget=address;
      } else validityTarget={};
    }
  }
  if (!records.length || records.length > 20000) throw new Error('Kostenträgerdatei enthält keine oder zu viele Institutionen.');
  return {fileName,importedAt:now,records};
}
const active = (entry: {from?: string; until?: string}, day: string) => (!entry.from || entry.from<=day) && (!entry.until || entry.until>=day);
export type RoutingQuery = { insuranceIk: string; service: ServiceType; channel:'classic'|'kim'; day:string; state:string; district?:string; billingCentre?:string };
export type RoutingResult = { payerIk:string; receiverIk:string; physicalReceiverIk:string; address:string; needsDirectoryLookup:boolean; sourceFile:string };
export function resolveCarrierRoute(directory: CarrierDirectory, query: RoutingQuery): RoutingResult {
  if (!isDate(query.day) || !isIk(query.insuranceIk)) throw new Error('Pflegekasse und Routingdatum sind erforderlich.');
  const find = (ik:string) => {
    const matches=directory.records.filter(r=>r.ik===ik && !r.deleted && active(r,query.day));
    if(matches.length!==1) throw new Error('Kostenträger oder Annahmestelle fehlt, ist abgelaufen oder nicht eindeutig.'); return matches[0];
  };
  const compatible = (l:CarrierLink) => active(l,query.day) && (!l.providerGroup || l.providerGroup==='6')
    && (!l.billingCentre || l.billingCentre===query.billingCentre) && (!l.state || l.state==='99' || l.state===query.state)
    && (!l.district || l.district===query.district) && (!l.medium || l.medium==='1');
  const unique = (links:CarrierLink[], required=true) => {
    const ids=[...new Set(links.map(l=>l.ik))]; if(ids.length!==1 && (required || ids.length)) throw new Error('Empfängerrouting fehlt oder ist mehrdeutig. Bitte Kostenträgerdaten prüfen.'); return ids[0];
  };
  const insurance=find(query.insuranceIk);
  const payerIk=unique(insurance.links.filter(l=>l.kind==='01' && compatible(l)),false) || insurance.ik;
  const payer=find(payerIk); const delivery=query.channel==='kim'?'30':'07';
  const eligible=payer.links.filter(l=>compatible(l) && l.delivery===delivery);
  const serviceMatch = (links:CarrierLink[]) => {
    const explicit=links.filter(l=>l.service===query.service || l.service==='00');
    return explicit.length ? explicit : links.filter(l=>l.service==='99');
  };
  const receiverIk=unique(serviceMatch(eligible.filter(l=>l.kind==='03')));
  const physicalReceiverIk=unique(serviceMatch(eligible.filter(l=>l.kind==='02')),false) || receiverIk;
  const receiver=find(physicalReceiverIk);
  const addresses=receiver.addresses.filter(a=>active(a,query.day) && active(a.mediumValidity||{},query.day) && a.protocol===(query.channel==='kim'?'080':'070') && a.medium==='1' && a.charset==='I1');
  const distinct=[...new Set(addresses.map(a=>a.address))];
  if(distinct.length!==1) throw new Error('Eindeutige Empfangsadresse für diesen Übermittlungsweg fehlt.');
  const address=distinct[0];
  if(address!=='VZD' && (!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(address) || address.length>254)) throw new Error('Ungültige Empfangsadresse.');
  if(address==='VZD' && query.channel!=='kim') throw new Error('VZD ist nur für KIM zulässig.');
  return {payerIk,receiverIk,physicalReceiverIk,address,needsDirectoryLookup:address==='VZD',sourceFile:directory.fileName};
}
