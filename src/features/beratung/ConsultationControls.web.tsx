import { useId, useEffect, useRef, useState, type ReactNode, type PointerEvent } from 'react';
import type { ConsultationSignature } from '../../lib/beratung/workspaceModel';
export function Field({ label, hint, children }: {
    label: string;
    hint?: string;
    children: ReactNode;
}) {
    return <label className="cw-field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}
export function TextField({ label, value, onChange, multiline = false, placeholder = '', disabled = false, type = 'text', required = false, maxLength = 10000 }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    multiline?: boolean;
    placeholder?: string;
    disabled?: boolean;
    type?: string;
    required?: boolean;
    maxLength?: number;
}) {
    const props = { value, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value), placeholder, disabled, required, maxLength };
    return <Field label={label}>{multiline ? <textarea {...props} rows={4}/> : <input {...props} type={type}/>}</Field>;
}
export function SelectField({ label, value, onChange, children, disabled = false }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    children: ReactNode;
    disabled?: boolean;
}) {
    return <Field label={label}><select value={value} onChange={e => onChange(e.target.value)} disabled={disabled}>{children}</select></Field>;
}
export function Dialog({ title, children, onClose, busy = false, wide = false }: {
    title: string;
    children: ReactNode;
    onClose: () => void;
    busy?: boolean;
    wide?: boolean;
}) {
    const ref = useRef<HTMLDialogElement>(null);
    const id = useId();
    useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close(); }, []);
    return <dialog ref={ref} className={`cw-modal ${wide ? 'cw-modal-wide' : ''}`} aria-labelledby={id} onCancel={e => { e.preventDefault(); if (!busy)
        onClose(); }}>
  <div className="cw-modal-head"><h2 id={id}>{title}</h2><button type="button" className="cw-icon-button" onClick={onClose} disabled={busy} aria-label="Dialog schließen">×</button></div>{children}
 </dialog>;
}
export function SignaturePad({ label, onChange, disabled = false }: {
    label: string;
    onChange: (image: string) => void;
    disabled?: boolean;
}) {
    const ref = useRef<HTMLCanvasElement>(null);
    const stroke = useRef<{
        pointer: number;
        x: number;
        y: number;
        length: number;
    } | null>(null);
    const total = useRef(0);
    const [signed, setSigned] = useState(false);
    function point(e: PointerEvent<HTMLCanvasElement>) { const rect = e.currentTarget.getBoundingClientRect(); return { x: (e.clientX - rect.left) * 840 / rect.width, y: (e.clientY - rect.top) * 240 / rect.height }; }
    function clear() { const canvas = ref.current; canvas?.getContext('2d')?.clearRect(0, 0, 840, 240); total.current = 0; stroke.current = null; setSigned(false); onChange(''); }
    function down(e: PointerEvent<HTMLCanvasElement>) { if (disabled || stroke.current)
        return; e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); const p = point(e); stroke.current = { pointer: e.pointerId, ...p, length: 0 }; }
    function move(e: PointerEvent<HTMLCanvasElement>) { const s = stroke.current; if (!s || s.pointer !== e.pointerId || disabled)
        return; const p = point(e); const context = e.currentTarget.getContext('2d'); if (context) {
        context.strokeStyle = '#122440';
        context.lineWidth = 3.3;
        context.lineCap = 'round';
        context.lineJoin = 'round';
        context.beginPath();
        context.moveTo(s.x, s.y);
        context.lineTo(p.x, p.y);
        context.stroke();
    } s.length += Math.hypot(p.x - s.x, p.y - s.y); s.x = p.x; s.y = p.y; }
    function end(e: PointerEvent<HTMLCanvasElement>) { const s = stroke.current; if (!s || s.pointer !== e.pointerId)
        return; total.current += s.length; stroke.current = null; if (e.currentTarget.hasPointerCapture(e.pointerId))
        e.currentTarget.releasePointerCapture(e.pointerId); if (total.current > 18) {
        setSigned(true);
        onChange(e.currentTarget.toDataURL('image/png'));
    } }
    return <div className="cw-signature"><div className="cw-between"><strong>{label}</strong><button type="button" className="cw-link" onClick={clear} disabled={disabled || !signed}>Neu zeichnen</button></div>
  <canvas ref={ref} width={840} height={240} aria-label={label} onPointerDown={down} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end} style={{ touchAction: 'none' }}/>
  <small>{signed ? 'Unterschrift erfasst' : 'Mit Stift, Finger oder Maus unterschreiben.'}</small>
 </div>;
}
export function SignatureDialog({ clientName, counselorName, summary, busy, error, onClose, onSubmit, training = false }: {
    training?: boolean;
    clientName: string;
    counselorName: string;
    summary: ReactNode;
    busy: boolean;
    error: string | null;
    onClose: () => void;
    onSubmit: (signatures: ConsultationSignature[]) => Promise<void>;
}) {
    const [name, setName] = useState(clientName);
    const [role, setRole] = useState<'client' | 'representative' | 'participant'>(training ? 'participant' : 'client');
    const [authority, setAuthority] = useState('');
    const [clientImage, setClientImage] = useState('');
    const [counselorImage, setCounselorImage] = useState('');
    const [confirmed, setConfirmed] = useState(false);
    const ready = Boolean(name.trim() && clientImage && counselorImage && confirmed && (role !== 'representative' || authority.trim()));
    return <Dialog title="Besuch bestätigen & einreichen" onClose={onClose} busy={busy} wide>
  <p>Bitte die Dokumentation gemeinsam prüfen. Mit der Einreichung werden dieser Inhalt und beide Unterschriften als unveränderbare Fassung gespeichert.</p>
  <details className="cw-summary" open><summary>Dokumentation zur Bestätigung</summary>{summary}</details>
  <fieldset disabled={busy} className="cw-reset-fieldset"><div className="cw-form-grid">
   <SelectField label="Bestätigende Person" value={role} onChange={v => { setRole(v as typeof role); setClientImage(''); }}><option value="client">Pflegebedürftige Person</option>{training && <option value="participant">Teilnehmende Pflegeperson</option>}<option value="representative">Vertretende Person</option></SelectField>
   <TextField label="Vor- und Nachname" value={name} onChange={v => { setName(v); setClientImage(''); }}/>
   {role === 'representative' && <TextField label="Vertretungsgrund / Befugnis" value={authority} onChange={setAuthority}/>}</div>
   <SignaturePad key={`${role}:${name}`} label="Unterschrift der bestätigenden Person" onChange={setClientImage} disabled={busy}/>
   <p><strong>Durchgeführt von {counselorName}</strong></p>
   <SignaturePad label="Unterschrift der Beratungsperson" onChange={setCounselorImage} disabled={busy}/>
   <label className="cw-check"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}/>Die angezeigte Dokumentation wurde geprüft. Die benannten Personen haben jeweils selbst unterschrieben.</label>
  </fieldset>
  {error && <p role="alert" className="cw-alert cw-alert-error">{error}</p>}
  <div className="cw-actions"><button type="button" className="cw-button" onClick={onClose} disabled={busy}>Zurück zur Dokumentation</button><button type="button" className="cw-button cw-primary" disabled={!ready || busy} onClick={() => void onSubmit([{ name: name.trim(), role, authority: authority.trim(), image: clientImage }, { name: counselorName, role: 'counselor', authority: '', image: counselorImage }])}>{busy ? 'Wird eingereicht …' : 'Verbindlich einreichen'}</button></div>
 </Dialog>;
}
