import { useId } from 'react';
import type { ClientIntakeFormData } from '@/types/forms/clientIntakeForm';
import type { IntakeDocumentTemplate } from '@/features/intakeDocuments/intakeDocumentTypes';
import { COMMUNICATION_CHOICES, getIntake2027Fields, INTAKE_2027_FIELDS, MEDIA_CHOICES, type IntakeLegalField } from '@/features/intakeDocuments/intake2027Fields';
import { hasCollectedIntakeOriginal } from '@/features/intakeDocuments/restartIntakeDocumentReview';

export function IntakeLegalDetails2027({ form, templates, onChange, disabled = false }: {
  form: ClientIntakeFormData; templates: IntakeDocumentTemplate[]; onChange(form: ClientIntakeFormData): void; disabled?: boolean;
}) {
  const id = useId();
  const values = form.intakeLegalDetails ?? {};
  const locked = disabled || form.intakeDocuments.some(hasCollectedIntakeOriginal);
  const keys = templates.map(template => template.templateKey);
  const fields = getIntake2027Fields(keys, form);
  const templateFields = new Set(Object.values(INTAKE_2027_FIELDS).flat().map(item => item.key));
  const change = (key: string, value: string) => onChange({ ...form, intakeLegalDetails: { ...values, [key]: value,
    ...(key === 'signer.capacity' && value === 'Die betreute Person selbst' ? { 'signer.name': `${form.firstName} ${form.lastName}`.trim() } : {}) } });
  const input = (item: IntakeLegalField) => <label className="cs-legal-field" key={item.key} htmlFor={`${id}-${item.key}`}>
    <span>{item.label}{!item.optional ? <small> erforderlich</small> : null}</span>
    {item.choices && ['signer.capacity', 'contract.conclusion', 'consulting.basis'].includes(item.key)
      ? <select id={`${id}-${item.key}`} value={values[item.key] ?? ''} disabled={locked} onChange={event => change(item.key, event.target.value)}><option value="">Bitte auswählen</option>{item.choices.map(choice => <option key={choice}>{choice}</option>)}</select>
      : <textarea id={`${id}-${item.key}`} rows={item.key.startsWith('provider.') || templateFields.has(item.key) ? 3 : 2} value={values[item.key] ?? ''} maxLength={10000} disabled={locked} onChange={event => change(item.key, event.target.value)} aria-describedby={item.help ? `${id}-${item.key}-help` : undefined}/>}
    {item.help ? <span id={`${id}-${item.key}-help`} className="cs-legal-help">{item.help}</span> : null}
    {item.choices && !['signer.capacity', 'contract.conclusion', 'consulting.basis'].includes(item.key) ? <span className="cs-legal-quick">{item.choices.map(choice => <button type="button" key={choice} disabled={locked} onClick={() => change(item.key, choice)}>{choice}</button>)}</span> : null}
  </label>;
  const choiceList = (choices: readonly { key: string; label: string; help?: string }[]) => <div className="cs-legal-choices">{choices.map(choice => <label key={choice.key}><input type="checkbox" checked={values[choice.key] === 'yes'} disabled={locked} onChange={event => change(choice.key, event.target.checked ? 'yes' : '')}/><span>{choice.label}{choice.help ? <small>{choice.help}</small> : null}</span></label>)}</div>;
  const filled = fields.filter(item => values[item.key]?.trim()).length;
  return <section className="cs-legal-editor" aria-label="Individuelle Vereinbarungen 2027"><header><div><span className="cs-legal-eyebrow">Ausgabe 2027</span><h3>Das wird wirklich vereinbart</h3><p>Die Angaben erscheinen unmittelbar im Dokument. Freiwillige Einwilligungen werden einzeln ausgewählt.</p></div><span className="cs-legal-progress">{filled} / {fields.length} Angaben</span></header>
    {form.intakeDocuments.some(hasCollectedIntakeOriginal) ? <p className="cs-contract-notice">Diese Angaben gehören zu einer bereits unterschriebenen Fassung. Für Änderungen zuerst eine neue Fassung beginnen; das Original bleibt erhalten.</p> : null}
    <details className="cs-legal-group" open><summary><span>Unternehmen, Datenschutz und Unterschreibende</span><span>{fields.filter(item => !templateFields.has(item.key)).length} Angaben</span></summary><div className="cs-legal-fields">{fields.filter(item => !templateFields.has(item.key)).map(input)}</div></details>
    {templates.filter(template => (INTAKE_2027_FIELDS[template.templateKey]?.length ?? 0) > 0 || ['communication_consent_default', 'photo_media_consent_default'].includes(template.templateKey)).map(template => <details key={template.templateKey} className="cs-legal-group"><summary><span>{template.title}</span><span>Vereinbarung öffnen</span></summary>
      {template.templateKey === 'communication_consent_default' ? choiceList(COMMUNICATION_CHOICES) : null}
      {template.templateKey === 'photo_media_consent_default' ? choiceList(MEDIA_CHOICES) : null}
      <div className="cs-legal-fields">{(INTAKE_2027_FIELDS[template.templateKey] ?? []).map(input)}</div>
    </details>)}
  </section>;
}
