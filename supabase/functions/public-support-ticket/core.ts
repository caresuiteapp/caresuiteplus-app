import {PUBLIC_EMAIL_PATTERN,PUBLIC_NONCE_PATTERN,publicAccessHash,type PublicAccessDb} from '../_shared/publicAccess.ts';

export function validatePublicSupport(body:Record<string,unknown>):string|null {
  for(const [key,min,max] of [['name',2,100],['email',3,254],['subject',3,180],['message',20,6000]] as const) {
    if(typeof body[key]!=='string' || body[key].trim().length<min || body[key].trim().length>max) return 'Bitte Name, E-Mail, Betreff und eine Beschreibung mit mindestens 20 Zeichen vollständig eingeben.';
  }
  if(!PUBLIC_EMAIL_PATTERN.test((body.email as string).trim())) return 'Bitte eine gültige E-Mail-Adresse eingeben.';
  if(body.organization!==undefined && (typeof body.organization!=='string' || body.organization.trim().length>200)) return 'Bitte den Unternehmensnamen prüfen.';
  if(!['technical','account','general'].includes(body.category as string)) return 'Bitte ein Thema auswählen.';
  if(body.privacyAccepted!==true) return 'Bitte bestätigen Sie die Datenschutzhinweise.';
  if(typeof body.nonce!=='string' || !PUBLIC_NONCE_PATTERN.test(body.nonce)) return 'Bitte die Anfrage erneut vorbereiten.';
  if(body.website) return 'Die Anfrage konnte nicht bestätigt werden.';
  return null;
}
export async function submitPublicSupport(client:PublicAccessDb,body:Record<string,unknown>,ip:string) {
  const invalid=validatePublicSupport(body);
  if(invalid) return {status:400,body:{ok:false,error:invalid}};
  const data={name:(body.name as string).trim(),email:(body.email as string).trim().toLowerCase(),organization:typeof body.organization==='string'?body.organization.trim():'',subject:(body.subject as string).trim(),message:(body.message as string).trim(),category:body.category,privacyAccepted:true};
  const {data:result,error}=await client.rpc('public_support_submit',{
    p_nonce:body.nonce,p_request_hash:await publicAccessHash(JSON.stringify(data)),
    p_ip_hash:await publicAccessHash(`ip:${ip}`),p_email_hash:await publicAccessHash(`account:${data.email}`),p_data:data,
  });
  if(error) throw new Error('public_support_save_unconfirmed');
  const receipt=result as {rateLimited?:boolean;reference?:unknown}|null;
  if(receipt?.rateLimited) return {status:429,body:{ok:false,error:'Zu viele Anfragen. Bitte warten Sie 15 Minuten und versuchen Sie es erneut.'}};
  if(typeof receipt?.reference!=='string' || !/^PUB-\d{6,}$/.test(receipt.reference)) throw new Error('public_support_receipt_unconfirmed');
  return {status:201,body:{ok:true,reference:receipt.reference}};
}
