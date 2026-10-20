/** Checks recorded data, never authorizes treatment or verifies an external prescription. */
export type MedicationOrderIntegrity = { status: 'active' | 'paused' | 'stopped' | 'archived' | 'unknown'; route: string | null; errors: string[]; missing: string[]; canRecord: boolean };
const value=(v:unknown)=>typeof v==='string'&&v.trim()&&!['nicht angegeben','unbekannt','unbenanntes medikament','-'].includes(v.trim().toLowerCase())?v.trim():null;
const date=(v:unknown)=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!v.startsWith('0000')&&Number.isFinite(Date.parse(v+'T12:00:00Z'))&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v;
const instant=(v:unknown)=>typeof v==='string'&&/^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(v)&&date(v.slice(0,10))&&Number.isFinite(Date.parse(v));
export function assessMedicationOrder(row:Record<string,unknown>,expected:{id:string;tenantId:string;clientId:string;updatedAt:string}):MedicationOrderIntegrity {
 const errors:string[]=[],missing:string[]=[];
 const status=typeof row.status==='string'&&['active','paused','stopped','archived'].includes(row.status)?row.status as Exclude<MedicationOrderIntegrity['status'],'unknown'>:'unknown';
 if(row.id!==expected.id||row.tenant_id!==expected.tenantId||row.client_id!==expected.clientId)errors.push('Verordnung, Mandant und Klient sind nicht eindeutig zugeordnet.');
 if(status==='unknown')errors.push('Der Verordnungsstatus ist ungeklärt.');
 if(!instant(row.updated_at)||row.updated_at!==expected.updatedAt)errors.push('Der Verordnungsstand ist ungültig oder zwischenzeitlich geändert. Bitte neu laden.');
 for(const key of ['is_prn','is_controlled_substance','is_high_alert'])if(typeof row[key]!=='boolean')errors.push('Bedarfs-, BtM- oder Hochrisikokennzeichnung ist nicht eindeutig.');
 for(const [key,label] of [['name','Präparat'],['dosage','Dosierung'],['route','Applikationsweg'],['prescribed_by','Verordnende Person']] as const)if(!value(row[key]))missing.push(label);
 if(!row.start_date)missing.push('Verordnungsbeginn');
 else if(!date(row.start_date))errors.push('Der Verordnungsbeginn ist ungültig.');
 if(row.end_date!=null&&!date(row.end_date))errors.push('Das Verordnungsende ist ungültig.');
 if(date(row.start_date)&&date(row.end_date)&&String(row.end_date)<String(row.start_date))errors.push('Das Verordnungsende liegt vor dem Beginn.');
 if(row.is_prn===true&&!value(row.prn_reason))missing.push('Verordnete Bedarfsindikation');
 return {status,route:value(row.route),errors,missing,canRecord:errors.length===0};
}
