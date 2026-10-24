// Generated native presentation from src/features/beratung/ConsultationControls.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeLabel,NativeSpan,NativeSmall,NativeTextarea,NativeInput,NativeSelect,NativeDialog,NativeDiv,NativeH2,NativeButton,NativeP,NativeDetails,NativeSummary,NativeFieldset,NativeOption,NativeStrong} from '@/components/layout/NativeWorkspaceElements.native';
import { CareSignatureCanvas } from '@/components/inputs/CareSignatureCanvas.tsx';
import { useId, useEffect, useRef, useState, type ReactNode, type PointerEvent } from 'react';
import type { ConsultationSignature } from '../../lib/beratung/workspaceModel';
export function Field({ label, hint, children }: {
    label: string;
    hint?: string;
    children: ReactNode;
}) {
    return <NativeLabel className="cw-field"><NativeSpan>{label}</NativeSpan>{children}{hint && <NativeSmall>{hint}</NativeSmall>}</NativeLabel>;
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
    return <Field label={label}>{multiline ? <NativeTextarea {...props} rows={4}/> : <NativeInput {...props} type={type}/>}</Field>;
}
export function SelectField({ label, value, onChange, children, disabled = false }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    children: ReactNode;
    disabled?: boolean;
}) {
    return <Field label={label}><NativeSelect value={value} onChange={e => onChange(e.target.value)} disabled={disabled}>{children}</NativeSelect></Field>;
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
    return <NativeDialog ref={ref} className={`cw-modal ${wide ? 'cw-modal-wide' : ''}`} aria-labelledby={id} onCancel={e => {
            e.preventDefault();
            if (!busy)
                onClose();
        }}>
  <NativeDiv className="cw-modal-head"><NativeH2 id={id}>{title}</NativeH2><NativeButton type="button" className="cw-icon-button" onClick={onClose} disabled={busy} aria-label="Dialog schließen">×</NativeButton></NativeDiv>{children}
 </NativeDialog>;
}
export function SignaturePad({ label, onChange, disabled = false }: {
    label: string;
    onChange(image: string): void;
    disabled?: boolean;
}) { return <CareSignatureCanvas label={label} size='large' disabled={disabled} width={840} height={240} onClear={() => onChange('')} onDirtyChange={() => onChange('')} onConfirm={onChange}/>; }
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
  <NativeP>Bitte die Dokumentation gemeinsam prüfen. Mit der Einreichung werden dieser Inhalt und beide Unterschriften als unveränderbare Fassung gespeichert.</NativeP>
  <NativeDetails className="cw-summary" open><NativeSummary>Dokumentation zur Bestätigung</NativeSummary>{summary}</NativeDetails>
  <NativeFieldset disabled={busy} className="cw-reset-fieldset"><NativeDiv className="cw-form-grid">
   <SelectField label="Bestätigende Person" value={role} onChange={v => { setRole(v as typeof role); setClientImage(''); }}><NativeOption value="client">Pflegebedürftige Person</NativeOption>{training && <NativeOption value="participant">Teilnehmende Pflegeperson</NativeOption>}<NativeOption value="representative">Vertretende Person</NativeOption></SelectField>
   <TextField label="Vor- und Nachname" value={name} onChange={v => { setName(v); setClientImage(''); }}/>
   {role === 'representative' && <TextField label="Vertretungsgrund / Befugnis" value={authority} onChange={setAuthority}/>}</NativeDiv>
   <SignaturePad key={`${role}:${name}`} label="Unterschrift der bestätigenden Person" onChange={setClientImage} disabled={busy}/>
   <NativeP><NativeStrong>Durchgeführt von {counselorName}</NativeStrong></NativeP>
   <SignaturePad label="Unterschrift der Beratungsperson" onChange={setCounselorImage} disabled={busy}/>
   <NativeLabel className="cw-check"><NativeInput type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}/>Die angezeigte Dokumentation wurde geprüft. Die benannten Personen haben jeweils selbst unterschrieben.</NativeLabel>
  </NativeFieldset>
  {error && <NativeP role="alert" className="cw-alert cw-alert-error">{error}</NativeP>}
  <NativeDiv className="cw-actions"><NativeButton type="button" className="cw-button" onClick={onClose} disabled={busy}>Zurück zur Dokumentation</NativeButton><NativeButton type="button" className="cw-button cw-primary" disabled={!ready || busy} onClick={() => void onSubmit([{ name: name.trim(), role, authority: authority.trim(), image: clientImage }, { name: counselorName, role: 'counselor', authority: '', image: counselorImage }])}>{busy ? 'Wird eingereicht …' : 'Verbindlich einreichen'}</NativeButton></NativeDiv>
 </Dialog>;
}
