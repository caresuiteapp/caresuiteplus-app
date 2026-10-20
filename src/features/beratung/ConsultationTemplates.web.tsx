import { useEffect, useRef, useState } from 'react';
import type { ConsultationGoal, ConsultationKind, ConsultationMeasure } from '../../lib/beratung/workspaceModel';
import { appendDistinctText, CONSULTATION_TEMPLATES, EVIDENCE_TYPES, goalFromTemplate, MEASURE_TEMPLATES, measureFromTemplate, type ConsultationTemplate } from '../../lib/beratung/workspaceTemplates';
import { Dialog, SelectField, TextField } from './ConsultationControls.web';

export function QuickChoices({ label, options, onChoose, disabled = false }: {
  label: string; options: readonly string[]; onChoose: (value: string) => void; disabled?: boolean;
}) {
  return <div className="cw-quick-choices" role="group" aria-label={label}><span className="cw-choice-label">{label}</span><div>{options.map(option => <button type="button" className="cw-choice" disabled={disabled} key={option} onClick={() => onChoose(option)}>{option}</button>)}</div></div>;
}

export function PreparationPicker({ kind, value, onChange, templates = CONSULTATION_TEMPLATES }: { kind: ConsultationKind; value: string; onChange: (value: string) => void; templates?: readonly ConsultationTemplate[] }) {
  const [selected, setSelected] = useState('');
  const template = templates.find(t => t.id === selected && t.kind === kind);
  return <div className="cw-template-picker"><SelectField label="Vorlage für die Vorbereitung" value={template?.id ?? ''} onChange={setSelected}><option value="">Passenden Anlass auswählen …</option>{templates.filter(t => t.kind === kind).map(t => <option key={t.id} value={t.id}>{t.title}{t.sourceLabel ? ` · ${t.sourceLabel}` : ''}</option>)}</SelectField>{template && <div className="cw-template-preview"><span className="cw-tag">Vorbereitung</span><p>{template.preparation}</p><button type="button" className="cw-button" disabled={value.includes(template.preparation)} onClick={() => onChange(appendDistinctText(value, template.preparation))}>{value.includes(template.preparation) ? 'Bereits ergänzt' : 'Vorbereitung ergänzen'}</button></div>}</div>;
}

export function TemplateLibrary({ initialKind, onClose, onUse, catalog = CONSULTATION_TEMPLATES }: {
  catalog?: readonly ConsultationTemplate[]; initialKind?: ConsultationKind; onClose: () => void; onUse?: (template: ConsultationTemplate) => void;
}) {
  const [kind, setKind] = useState(initialKind ?? 'all');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [selected, setSelected] = useState<string | null>(null);
  const preview = useRef<HTMLElement>(null);
  useEffect(() => {
    if (selected) preview.current?.scrollIntoView?.({ block: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, [selected]);
  const candidates = catalog.filter(t => kind === 'all' || t.kind === kind);
  const categories = [...new Set(candidates.map(t => t.category))];
  const templates = candidates.filter(t => (category === 'all' || t.category === category) && `${t.title} ${t.description} ${t.category}`.toLocaleLowerCase('de').includes(search.trim().toLocaleLowerCase('de')));
  const active = templates.find(t => t.id === selected);
  return <Dialog title="Vorlagenbibliothek" onClose={onClose} wide><p className="cw-muted">Ein passender Einstieg für jeden Besuch. Die Bausteine lassen sich individuell anpassen.</p><div className="cw-form-grid"><TextField label="Vorlagen suchen" value={search} onChange={setSearch} placeholder="Zum Beispiel Mobilität, Entlastung …"/><SelectField label="Vorlagen für" value={kind} onChange={v => { setKind(v); setCategory('all'); }}><option value="all">Beratung & Schulung</option><option value="37_3">Beratung § 37.3</option><option value="45">Schulung § 45</option></SelectField></div><div className="cw-filter-chips" role="group" aria-label="Vorlagenkategorie">{['all', ...categories].map(c => <button type="button" key={c} className="cw-choice" aria-pressed={category === c} onClick={() => setCategory(c)}>{c === 'all' ? 'Alle Themen' : c}</button>)}</div><p className="cw-muted" role="status">{templates.length} passende Vorlagen</p><div className="cw-template-cards">{templates.map(t => <button type="button" key={t.id} className="cw-template-card" aria-pressed={selected === t.id} onClick={() => setSelected(t.id)}><span className="cw-tag">{t.kind === '45' ? '§ 45 · Schulung' : '§ 37.3 · Beratung'}</span><strong>{t.title}</strong><span>{t.description}</span><small>{t.sourceLabel ?? t.category} <span aria-hidden>↗</span></small></button>)}</div>{!templates.length && <p className="cw-empty">Keine passende Vorlage. Versuchen Sie einen anderen Suchbegriff.</p>}{active && <section ref={preview} className="cw-template-preview" aria-label={`Vorschau: ${active.title}`}><h3>{active.title}</h3><p>{active.preparation}</p><strong>Gesprächsimpulse</strong><ul>{active.prompts.map(p => <li key={p}>{p}</li>)}</ul>{active.goal && <p><strong>Mögliches Lernziel:</strong> {active.goal}</p>}{onUse && <button type="button" className="cw-button cw-primary" onClick={() => onUse(active)}>Mit dieser Vorlage planen</button>}</section>}<p className="cw-template-note">Vorlagen unterstützen die Vorbereitung. Die tatsächlich durchgeführte Beratung und fachliche Einschätzung dokumentieren Sie im Besuch.</p></Dialog>;
}

export function EvidenceBuilder({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [type, setType] = useState(EVIDENCE_TYPES[0]);
  const [reference, setReference] = useState('');
  const [issuer, setIssuer] = useState('');
  const [checked, setChecked] = useState('');
  const [added, setAdded] = useState(false);
  const entry = `${type}: ${reference.trim()} · Stelle: ${issuer.trim()} · geprüft am ${checked}`;
  const nextEvidence = appendDistinctText(value, entry);
  return <details className="cw-evidence-builder"><summary>Nachweis strukturiert erfassen</summary><p className="cw-muted">Tragen Sie die tatsächlich geprüfte Unterlage und ihre Fundstelle ein.</p><SelectField label="Art des Nachweises" value={type} onChange={setType}>{EVIDENCE_TYPES.map(t => <option key={t}>{t}</option>)}</SelectField><TextField label="Bezeichnung / Referenz / Ablageort" value={reference} onChange={v => { setReference(v); setAdded(false); }} placeholder="Dokumentname, Aktenzeichen oder interne Fundstelle"/><div className="cw-form-grid"><TextField label="Ausstellende oder vertragliche Stelle" value={issuer} onChange={setIssuer}/><TextField label="Geprüft am" type="date" value={checked} onChange={setChecked}/></div><button type="button" className="cw-button" disabled={!reference.trim() || !issuer.trim() || !checked || nextEvidence.length > 2000} onClick={() => { onChange(nextEvidence); setReference(''); setAdded(true); }}>Nachweis ergänzen</button>{nextEvidence.length > 2000 && <p role="alert" className="cw-muted">Bitte kürzen Sie den Nachweis. Insgesamt sind 2.000 Zeichen möglich.</p>}{added && <p className="cw-muted" role="status">Nachweis in die Dokumentation übernommen. Freigabe anschließend speichern.</p>}</details>;
}

export function TrainingPicker({ goals, onChange, templates = CONSULTATION_TEMPLATES }: { goals: ConsultationGoal[]; onChange: (goals: ConsultationGoal[]) => void; templates?: readonly ConsultationTemplate[] }) {
  const [selected, setSelected] = useState('');
  const template = templates.find(t => t.id === selected && t.kind === '45');
  const exists = Boolean(template && goals.some(g => g.title === template.goal));
  return <div className="cw-template-picker"><SelectField label="Schulungsbaustein auswählen" value={selected} onChange={setSelected}><option value="">Individuelles Lernziel vorbereiten …</option>{templates.filter(t => t.kind === '45').map(t => <option key={t.id} value={t.id}>{t.title}{t.sourceLabel ? ` · ${t.sourceLabel}` : ''}</option>)}</SelectField>{template && <div className="cw-template-preview"><p><strong>Lernziel:</strong> {template.goal}</p><ul>{template.prompts.map(p => <li key={p}>{p}</li>)}</ul><button type="button" className="cw-button" disabled={exists} onClick={() => { const goal = goalFromTemplate(template, crypto.randomUUID()); if (goal) onChange([...goals, goal]); }}>{exists ? 'Lernziel bereits vorhanden' : 'Lernziel übernehmen'}</button><p className="cw-muted">Anleitung, durchgeführte Übung und Lernergebnis ergänzen Sie nach der tatsächlichen Durchführung.</p></div>}</div>;
}

export function MeasurePicker({ measures, onChange }: { measures: ConsultationMeasure[]; onChange: (measures: ConsultationMeasure[]) => void }) {
  const [selected, setSelected] = useState('');
  const template = MEASURE_TEMPLATES.find(t => t.id === selected);
  const exists = Boolean(template && measures.some(m => m.title === template.title));
  return <div className="cw-template-picker"><SelectField label="Empfehlung vorbereiten" value={selected} onChange={setSelected}><option value="">Passenden Baustein auswählen …</option>{MEASURE_TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}</SelectField>{template && <button type="button" className="cw-button" disabled={exists} onClick={() => onChange([...measures, measureFromTemplate(template.title, crypto.randomUUID())])}>{exists ? 'Empfehlung bereits vorhanden' : 'Empfehlung übernehmen'}</button>}</div>;
}
