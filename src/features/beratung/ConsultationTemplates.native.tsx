// Generated native presentation from src/features/beratung/ConsultationTemplates.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {nativeWindow as window,nativeCrypto as crypto} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {NativeDiv,NativeSpan,NativeButton,NativeOption,NativeP,NativeStrong,NativeSmall,NativeSection,NativeH3,NativeUl,NativeLi,NativeDetails,NativeSummary} from '@/components/layout/NativeWorkspaceElements.native';
import { useEffect, useRef, useState } from 'react';
import type { ConsultationGoal, ConsultationKind, ConsultationMeasure } from '../../lib/beratung/workspaceModel';
import { appendDistinctText, CONSULTATION_TEMPLATES, EVIDENCE_TYPES, goalFromTemplate, MEASURE_TEMPLATES, measureFromTemplate, type ConsultationTemplate } from '../../lib/beratung/workspaceTemplates';
import { Dialog, SelectField, TextField } from "./ConsultationControls.native.tsx";
export function QuickChoices({ label, options, onChoose, disabled = false }: {
    label: string;
    options: readonly string[];
    onChoose: (value: string) => void;
    disabled?: boolean;
}) {
    return <NativeDiv className="cw-quick-choices" role="group" aria-label={label}><NativeSpan className="cw-choice-label">{label}</NativeSpan><NativeDiv>{options.map(option => <NativeButton type="button" className="cw-choice" disabled={disabled} key={option} onClick={() => onChoose(option)}>{option}</NativeButton>)}</NativeDiv></NativeDiv>;
}
export function PreparationPicker({ kind, value, onChange, templates = CONSULTATION_TEMPLATES }: {
    kind: ConsultationKind;
    value: string;
    onChange: (value: string) => void;
    templates?: readonly ConsultationTemplate[];
}) {
    const [selected, setSelected] = useState('');
    const template = templates.find(t => t.id === selected && t.kind === kind);
    return <NativeDiv className="cw-template-picker"><SelectField label="Vorlage für die Vorbereitung" value={template?.id ?? ''} onChange={setSelected}><NativeOption value="">Passenden Anlass auswählen …</NativeOption>{templates.filter(t => t.kind === kind).map(t => <NativeOption key={t.id} value={t.id}>{t.title}{t.sourceLabel ? ` · ${t.sourceLabel}` : ''}</NativeOption>)}</SelectField>{template && <NativeDiv className="cw-template-preview"><NativeSpan className="cw-tag">Vorbereitung</NativeSpan><NativeP>{template.preparation}</NativeP><NativeButton type="button" className="cw-button" disabled={value.includes(template.preparation)} onClick={() => onChange(appendDistinctText(value, template.preparation))}>{value.includes(template.preparation) ? 'Bereits ergänzt' : 'Vorbereitung ergänzen'}</NativeButton></NativeDiv>}</NativeDiv>;
}
export function TemplateLibrary({ initialKind, onClose, onUse, catalog = CONSULTATION_TEMPLATES }: {
    catalog?: readonly ConsultationTemplate[];
    initialKind?: ConsultationKind;
    onClose: () => void;
    onUse?: (template: ConsultationTemplate) => void;
}) {
    const [kind, setKind] = useState(initialKind ?? 'all');
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('all');
    const [selected, setSelected] = useState<string | null>(null);
    const preview = useRef<HTMLElement>(null);
    useEffect(() => {
        if (selected)
            preview.current?.scrollIntoView?.({ block: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }, [selected]);
    const candidates = catalog.filter(t => kind === 'all' || t.kind === kind);
    const categories = [...new Set(candidates.map(t => t.category))];
    const templates = candidates.filter(t => (category === 'all' || t.category === category) && `${t.title} ${t.description} ${t.category}`.toLocaleLowerCase('de').includes(search.trim().toLocaleLowerCase('de')));
    const active = templates.find(t => t.id === selected);
    return <Dialog title="Vorlagenbibliothek" onClose={onClose} wide><NativeP className="cw-muted">Ein passender Einstieg für jeden Besuch. Die Bausteine lassen sich individuell anpassen.</NativeP><NativeDiv className="cw-form-grid"><TextField label="Vorlagen suchen" value={search} onChange={setSearch} placeholder="Zum Beispiel Mobilität, Entlastung …"/><SelectField label="Vorlagen für" value={kind} onChange={v => { setKind(v); setCategory('all'); }}><NativeOption value="all">Beratung & Schulung</NativeOption><NativeOption value="37_3">Beratung § 37.3</NativeOption><NativeOption value="45">Schulung § 45</NativeOption></SelectField></NativeDiv><NativeDiv className="cw-filter-chips" role="group" aria-label="Vorlagenkategorie">{['all', ...categories].map(c => <NativeButton type="button" key={c} className="cw-choice" aria-pressed={category === c} onClick={() => setCategory(c)}>{c === 'all' ? 'Alle Themen' : c}</NativeButton>)}</NativeDiv><NativeP className="cw-muted" role="status">{templates.length} passende Vorlagen</NativeP><NativeDiv className="cw-template-cards">{templates.map(t => <NativeButton type="button" key={t.id} className="cw-template-card" aria-pressed={selected === t.id} onClick={() => setSelected(t.id)}><NativeSpan className="cw-tag">{t.kind === '45' ? '§ 45 · Schulung' : '§ 37.3 · Beratung'}</NativeSpan><NativeStrong>{t.title}</NativeStrong><NativeSpan>{t.description}</NativeSpan><NativeSmall>{t.sourceLabel ?? t.category} <NativeSpan aria-hidden>↗</NativeSpan></NativeSmall></NativeButton>)}</NativeDiv>{!templates.length && <NativeP className="cw-empty">Keine passende Vorlage. Versuchen Sie einen anderen Suchbegriff.</NativeP>}{active && <NativeSection ref={preview} className="cw-template-preview" aria-label={`Vorschau: ${active.title}`}><NativeH3>{active.title}</NativeH3><NativeP>{active.preparation}</NativeP><NativeStrong>Gesprächsimpulse</NativeStrong><NativeUl>{active.prompts.map(p => <NativeLi key={p}>{p}</NativeLi>)}</NativeUl>{active.goal && <NativeP><NativeStrong>Mögliches Lernziel:</NativeStrong> {active.goal}</NativeP>}{onUse && <NativeButton type="button" className="cw-button cw-primary" onClick={() => onUse(active)}>Mit dieser Vorlage planen</NativeButton>}</NativeSection>}<NativeP className="cw-template-note">Vorlagen unterstützen die Vorbereitung. Die tatsächlich durchgeführte Beratung und fachliche Einschätzung dokumentieren Sie im Besuch.</NativeP></Dialog>;
}
export function EvidenceBuilder({ value, onChange }: {
    value: string;
    onChange: (value: string) => void;
}) {
    const [type, setType] = useState(EVIDENCE_TYPES[0]);
    const [reference, setReference] = useState('');
    const [issuer, setIssuer] = useState('');
    const [checked, setChecked] = useState('');
    const [added, setAdded] = useState(false);
    const entry = `${type}: ${reference.trim()} · Stelle: ${issuer.trim()} · geprüft am ${checked}`;
    const nextEvidence = appendDistinctText(value, entry);
    return <NativeDetails className="cw-evidence-builder"><NativeSummary>Nachweis strukturiert erfassen</NativeSummary><NativeP className="cw-muted">Tragen Sie die tatsächlich geprüfte Unterlage und ihre Fundstelle ein.</NativeP><SelectField label="Art des Nachweises" value={type} onChange={setType}>{EVIDENCE_TYPES.map(t => <NativeOption key={t}>{t}</NativeOption>)}</SelectField><TextField label="Bezeichnung / Referenz / Ablageort" value={reference} onChange={v => { setReference(v); setAdded(false); }} placeholder="Dokumentname, Aktenzeichen oder interne Fundstelle"/><NativeDiv className="cw-form-grid"><TextField label="Ausstellende oder vertragliche Stelle" value={issuer} onChange={setIssuer}/><TextField label="Geprüft am" type="date" value={checked} onChange={setChecked}/></NativeDiv><NativeButton type="button" className="cw-button" disabled={!reference.trim() || !issuer.trim() || !checked || nextEvidence.length > 2000} onClick={() => { onChange(nextEvidence); setReference(''); setAdded(true); }}>Nachweis ergänzen</NativeButton>{nextEvidence.length > 2000 && <NativeP role="alert" className="cw-muted">Bitte kürzen Sie den Nachweis. Insgesamt sind 2.000 Zeichen möglich.</NativeP>}{added && <NativeP className="cw-muted" role="status">Nachweis in die Dokumentation übernommen. Freigabe anschließend speichern.</NativeP>}</NativeDetails>;
}
export function TrainingPicker({ goals, onChange, templates = CONSULTATION_TEMPLATES }: {
    goals: ConsultationGoal[];
    onChange: (goals: ConsultationGoal[]) => void;
    templates?: readonly ConsultationTemplate[];
}) {
    const [selected, setSelected] = useState('');
    const template = templates.find(t => t.id === selected && t.kind === '45');
    const exists = Boolean(template && goals.some(g => g.title === template.goal));
    return <NativeDiv className="cw-template-picker"><SelectField label="Schulungsbaustein auswählen" value={selected} onChange={setSelected}><NativeOption value="">Individuelles Lernziel vorbereiten …</NativeOption>{templates.filter(t => t.kind === '45').map(t => <NativeOption key={t.id} value={t.id}>{t.title}{t.sourceLabel ? ` · ${t.sourceLabel}` : ''}</NativeOption>)}</SelectField>{template && <NativeDiv className="cw-template-preview"><NativeP><NativeStrong>Lernziel:</NativeStrong> {template.goal}</NativeP><NativeUl>{template.prompts.map(p => <NativeLi key={p}>{p}</NativeLi>)}</NativeUl><NativeButton type="button" className="cw-button" disabled={exists} onClick={() => { const goal = goalFromTemplate(template, crypto.randomUUID()); if (goal)
        onChange([...goals, goal]); }}>{exists ? 'Lernziel bereits vorhanden' : 'Lernziel übernehmen'}</NativeButton><NativeP className="cw-muted">Anleitung, durchgeführte Übung und Lernergebnis ergänzen Sie nach der tatsächlichen Durchführung.</NativeP></NativeDiv>}</NativeDiv>;
}
export function MeasurePicker({ measures, onChange }: {
    measures: ConsultationMeasure[];
    onChange: (measures: ConsultationMeasure[]) => void;
}) {
    const [selected, setSelected] = useState('');
    const template = MEASURE_TEMPLATES.find(t => t.id === selected);
    const exists = Boolean(template && measures.some(m => m.title === template.title));
    return <NativeDiv className="cw-template-picker"><SelectField label="Empfehlung vorbereiten" value={selected} onChange={setSelected}><NativeOption value="">Passenden Baustein auswählen …</NativeOption>{MEASURE_TEMPLATES.map(t => <NativeOption key={t.id} value={t.id}>{t.title}</NativeOption>)}</SelectField>{template && <NativeButton type="button" className="cw-button" disabled={exists} onClick={() => onChange([...measures, measureFromTemplate(template.title, crypto.randomUUID())])}>{exists ? 'Empfehlung bereits vorhanden' : 'Empfehlung übernehmen'}</NativeButton>}</NativeDiv>;
}
