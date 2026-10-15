import { useEffect, useId, useRef, useState } from 'react';
import { messagingScope, useMessageResource } from '@/hooks/useMessageWorkspace.web';
import { listQuickReplyTemplates, saveQuickReplyTemplate, type QuickReplyTemplateRecord } from '@/lib/office/messageQuickReplyTemplateService';
import { OFFICE_QUICK_REPLY_TEMPLATES } from '@/lib/office/messagequickreplies';
import type { MessagingActor } from '@/lib/office/messageWorkspaceService.web';
import { MessageButton, MessageDialog, MessageIcon, MessageNotice } from './MessagePrimitives.web';

type TemplateForm = { id?: string; key: string; label: string; body: string; sortOrder: number; isActive: boolean };
const blank = (): TemplateForm => ({ key: crypto.randomUUID(), label: '', body: '', sortOrder: 0, isActive: true });
export function MessageTemplates({ actor, canEdit, onClose, onDirtyChange, onBusyChange, onSaved }: {
  actor: MessagingActor; canEdit: boolean; onClose: () => void; onDirtyChange: (value: boolean) => void; onBusyChange: (value: boolean) => void; onSaved: () => void;
}) {
  const id = useId(); const [form, setForm] = useState<TemplateForm>(blank); const [baseline, setBaseline] = useState('');
  const [search, setSearch] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const flight = useRef(false); const alive = useRef(true);
  const dirty = baseline ? JSON.stringify(form) !== baseline : !!form.label || !!form.body;
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { onDirtyChange(dirty); return () => onDirtyChange(false); }, [dirty, onDirtyChange]);
  useEffect(() => { onBusyChange(busy); return () => onBusyChange(false); }, [busy, onBusyChange]);
  const resource = useMessageResource(`${messagingScope(actor)}:template-management`, () => listQuickReplyTemplates(actor.tenantId, actor.roleKey));
  const close = () => { if (!busy && (!dirty || window.confirm('Änderungen an der Vorlage verwerfen?'))) onClose(); };
  function select(record?: QuickReplyTemplateRecord) { if (busy || (dirty && !window.confirm('Änderungen an der Vorlage verwerfen?'))) return; const next = record ? { ...record } : blank(); setForm(next); setBaseline(record ? JSON.stringify(next) : ''); setError(''); setNotice(''); }
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (flight.current || !canEdit) return;
    if (!form.label.trim() || !form.body.trim()) { setError('Bitte Bezeichnung und Antworttext ausfüllen.'); return; }
    flight.current = true; setBusy(true); setError(''); setNotice('');
    try {
      // Resolve a lost insert response by the immutable key before attempting another insert.
      const latest = await listQuickReplyTemplates(actor.tenantId, actor.roleKey);
      if (!latest.ok) { if (alive.current) setError(latest.error); return; }
      const existing = latest.data.find(item => item.key === form.key);
      const result = await saveQuickReplyTemplate(actor.tenantId, { ...form, id: form.id ?? existing?.id }, actor.roleKey);
      if (!alive.current) return;
      if (!result.ok) { setError(result.error); return; }
      setForm(result.data); setBaseline(JSON.stringify(result.data)); setNotice('Vorlage gespeichert.'); onSaved(); await resource.refresh();
    } catch { if (alive.current) setError('Die Vorlage konnte nicht bestätigt werden. Ihre Eingaben bleiben erhalten.'); }
    finally { flight.current = false; if (alive.current) setBusy(false); }
  }
  const records = (resource.data ?? []).filter(item => `${item.label} ${item.body}`.toLocaleLowerCase('de-DE').includes(search.toLocaleLowerCase('de-DE')));
  return <MessageDialog title="Schnellantworten" wide busy={busy} onClose={close}><form onSubmit={event => void save(event)}><div className="mw-dialog-scroll"><p>Wiederkehrende Antworten zentral vorbereiten und beim Schreiben mit einem Klick einfügen.</p>{error && <MessageNotice error>{error}</MessageNotice>}{notice && <MessageNotice>{notice}</MessageNotice>}{resource.error && <MessageNotice error onRetry={() => void resource.refresh()}>{resource.error}</MessageNotice>}<div className="mw-management-layout"><section className="mw-management-card"><div className="mw-actions"><h3>Eigene Vorlagen</h3>{canEdit && <MessageButton icon="plus" disabled={busy} onClick={() => select()}>Neu</MessageButton>}</div><div className="mw-search"><MessageIcon name="search" /><input aria-label="Vorlagen durchsuchen" placeholder="Vorlage suchen" value={search} onChange={event => setSearch(event.target.value)} /></div>{resource.loading && !resource.data ? <div className="mw-loading">Vorlagen werden geladen</div> : records.length ? records.map(item => <button type="button" className="mw-template" key={item.id} aria-pressed={form.id === item.id} disabled={busy} onClick={() => select(item)}><strong>{item.label}{!item.isActive && <span className="mw-tag"> · Inaktiv</span>}</strong><p>{item.body.length > 140 ? `${item.body.slice(0, 140)}…` : item.body}</p></button>) : <small>Keine eigenen Vorlagen gefunden.</small>}<details><summary>Mitgelieferte Schnellantworten</summary><div style={{ display: 'grid', gap: 8, marginTop: 12 }}>{OFFICE_QUICK_REPLY_TEMPLATES.map(item => <div className="mw-template" key={item.key}><strong>{item.label}</strong><p>{item.body}</p></div>)}</div></details></section><section className="mw-management-card"><h3>{form.id ? 'Vorlage bearbeiten' : 'Neue Vorlage'}</h3><div className="mw-field"><label htmlFor={`${id}-label`}>Bezeichnung *</label><input id={`${id}-label`} value={form.label} maxLength={100} disabled={busy || !canEdit} onChange={event => setForm(value => ({ ...value, label: event.target.value }))} placeholder="z. B. Terminbestätigung" /></div><div className="mw-field"><label htmlFor={`${id}-body`}>Antworttext *</label><textarea id={`${id}-body`} value={form.body} maxLength={12000} rows={9} disabled={busy || !canEdit} onChange={event => setForm(value => ({ ...value, body: event.target.value }))} placeholder="Text der Schnellantwort …" /></div><label className="mw-check"><input type="checkbox" checked={form.isActive} disabled={busy || !canEdit} onChange={event => setForm(value => ({ ...value, isActive: event.target.checked }))} /><span>Im Schreibbereich anbieten<small>Deaktivierte Vorlagen bleiben zur späteren Bearbeitung erhalten.</small></span></label></section></div></div><footer className="mw-dialog-footer"><p>{dirty ? 'Noch nicht gespeicherte Änderungen' : 'Die Auswahl einer Vorlage versendet keine Nachricht.'}</p><div className="mw-actions"><MessageButton disabled={busy} onClick={close}>Schließen</MessageButton>{canEdit && <MessageButton type="submit" tone="primary" icon="check" disabled={busy || !dirty || !!resource.error}>{busy ? 'Wird gespeichert …' : 'Vorlage speichern'}</MessageButton>}</div></footer></form></MessageDialog>;
}
