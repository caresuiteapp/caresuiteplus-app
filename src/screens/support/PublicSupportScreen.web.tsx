import {useRef,useState,type FormEvent} from 'react';
import {PublicAccessShell} from '@/liquid-command/components/PublicAccessShell.web';
import {LiquidSurface} from '@/liquid-command/components/LiquidPrimitives';
import {newPublicSupportNonce,submitPublicSupportTicket,type PublicSupportInput} from '@/lib/support/publicSupportService';

const initial={name:'',email:'',organization:'',subject:'',category:'technical' as PublicSupportInput['category'],message:'',privacyAccepted:false,website:''};
export default function PublicSupportScreen() {
  const [form,setForm]=useState(initial);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [receipt,setReceipt]=useState<string|null>(null);
  const nonce=useRef<string|null>(null);
  if(!nonce.current) nonce.current=newPublicSupportNonce();
  const inFlight=useRef(false);
  const update=<K extends keyof typeof initial>(key:K,value:(typeof initial)[K])=>{
    nonce.current=newPublicSupportNonce();setForm(current=>({...current,[key]:value}));
  };
  const submit=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();if(inFlight.current)return;
    inFlight.current=true;setBusy(true);setError(null);
    try {
      const result=await submitPublicSupportTicket({...form,nonce:nonce.current!});
      if(!result.ok){setError(result.error);return;}
      setReceipt(result.data.reference);setForm(initial);
    } catch {setError('Das Ticket konnte nicht bestätigt werden. Ihre Eingaben bleiben erhalten. Bitte versuchen Sie es erneut.');}
    finally{inFlight.current=false;setBusy(false);}
  };
  return <PublicAccessShell>
    <LiquidSurface active><div className="cs-public-support">
      <style>{`.cs-public-support{background:#091324;border-radius:18px;padding:28px;color:#dceaff;font-family:Arial,Helvetica,sans-serif}.cs-public-support h2{margin:0 0 12px;font-size:24px;color:#fff}.cs-public-support p{line-height:1.7;color:#abc3df}.cs-public-support .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.cs-public-support label{display:block;font-size:13px;font-weight:600;margin:0 0 8px}.cs-public-support input,.cs-public-support textarea,.cs-public-support select{box-sizing:border-box;width:100%;border:1px solid #345681;border-radius:13px;padding:13px;background:#09182c;color:#f3f8ff;font:inherit;outline:none}.cs-public-support input:focus,.cs-public-support textarea:focus,.cs-public-support select:focus{border-color:#70c3ff;box-shadow:0 0 0 3px #2798ff30}.cs-public-support textarea{resize:vertical;min-height:155px;line-height:1.6}.cs-public-support .full{grid-column:1/-1}.cs-public-support .consent{display:flex;gap:10px;align-items:flex-start;line-height:1.6;font-weight:normal}.cs-public-support input[type=checkbox]{width:20px;height:20px;flex-shrink:0;margin-top:1px;accent-color:#248cff}.cs-public-support button{border:1px solid #67b3ff;border-radius:13px;background:#126cff;color:white;padding:15px 21px;font:inherit;font-weight:700;cursor:pointer}.cs-public-support button:disabled{opacity:.65;cursor:wait}.cs-public-support a{color:#93d4ff}.cs-public-support .notice{padding:16px;border:1px solid #315781;border-radius:15px;background:#102039;margin-bottom:20px;overflow-wrap:anywhere}.cs-public-support .error{border-color:#f37e8c;background:#321e2c}.cs-public-support .receipt{color:#a8f0d1;border-color:#397b68;background:#102b28}.cs-public-support .trap{display:none}.cs-public-support small{font-size:12px;color:#99b4d3}.cs-public-support .actions{margin-top:20px;display:flex;flex-wrap:wrap;align-items:center;gap:20px}@media(max-width:600px){.cs-public-support{padding:20px}.cs-public-support .grid{grid-template-columns:minmax(0,1fr)}.cs-public-support button{width:100%}}`}</style>
      {receipt?<div role="status" className="notice receipt"><h2>Ihr Ticket ist eingegangen.</h2><p>Ihre Ticketnummer: <strong>{receipt}</strong></p><p>Bewahren Sie diese Nummer für Rückfragen auf. Unser Support meldet sich über Ihre angegebene E-Mail-Adresse. Die Systemadresse für automatische Benachrichtigungen nimmt keine Antworten entgegen.</p><button onClick={()=>{setReceipt(null);nonce.current=newPublicSupportNonce();}}>Weitere Anfrage einreichen</button></div>:<>
        <h2>Ihr Anliegen verdient eine klare Antwort.</h2><p>Pflichtfelder sind mit * markiert. Für Probleme mit der Anmeldung wählen Sie „Zugang & Anmeldung“.</p>
        {error?<div role="alert" className="notice error">{error}</div>:null}
        <form onSubmit={event=>void submit(event)}>
          <fieldset disabled={busy} style={{border:0,padding:0,margin:0}}><div className="grid">
            <div><label htmlFor="support-name">Ihr Name *</label><input id="support-name" autoComplete="name" required minLength={2} maxLength={100} value={form.name} onChange={event=>update('name',event.target.value)}/></div>
            <div><label htmlFor="support-email">Ihre E-Mail-Adresse *</label><input id="support-email" type="email" autoComplete="email" required maxLength={254} value={form.email} onChange={event=>update('email',event.target.value)}/></div>
            <div><label htmlFor="support-company">Unternehmen / Organisation</label><input id="support-company" autoComplete="organization" maxLength={200} value={form.organization} onChange={event=>update('organization',event.target.value)}/></div>
            <div><label htmlFor="support-category">Thema *</label><select id="support-category" value={form.category} onChange={event=>update('category',event.target.value as PublicSupportInput['category'])}><option value="technical">Technisches Problem</option><option value="account">Zugang & Anmeldung</option><option value="general">Allgemeine Frage</option></select></div>
            <div className="full"><label htmlFor="support-subject">Betreff *</label><input id="support-subject" required minLength={3} maxLength={180} value={form.subject} onChange={event=>update('subject',event.target.value)}/></div>
            <div className="full"><label htmlFor="support-message">Was können wir für Sie tun? *</label><textarea id="support-message" required minLength={20} maxLength={6000} value={form.message} onChange={event=>update('message',event.target.value)} placeholder="Beschreiben Sie die betroffene Seite, den Ablauf und die angezeigte Meldung."/><small>Mindestens 20 Zeichen · {form.message.length}/6000. Bitte keine Passwörter, Gesundheitsdaten oder Klientenunterlagen einfügen.</small></div>
            <div className="trap" aria-hidden="true"><label htmlFor="support-website">Website</label><input id="support-website" tabIndex={-1} autoComplete="off" value={form.website} onChange={event=>update('website',event.target.value)}/></div>
            <div className="full"><label className="consent"><input type="checkbox" required checked={form.privacyAccepted} onChange={event=>update('privacyAccepted',event.target.checked)}/><span>Ich habe die <a href="/datenschutz" target="_blank" rel="noopener noreferrer">Datenschutzhinweise</a> zur Bearbeitung meiner Anfrage gelesen. *</span></label></div>
          </div></fieldset>
          <div className="actions"><button type="submit" disabled={busy}>{busy?'Ticket wird eingereicht …':'Support-Ticket einreichen →'}</button><a href="/auth/business-login">Zur Verwaltungsanmeldung</a></div>
        </form>
      </>}
    </div></LiquidSurface>
  </PublicAccessShell>;
}
