// Generated native presentation from src/components/inputs/IntakeLegalDetails2027.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeLabel,NativeSpan,NativeSmall,NativeSelect,NativeOption,NativeTextarea,NativeButton,NativeDiv,NativeInput,NativeSection,NativeHeader,NativeH3,NativeP,NativeDetails,NativeSummary} from '@/components/layout/NativeWorkspaceElements.native';
import { useId } from 'react';
import type { ClientIntakeFormData } from '@/types/forms/clientIntakeForm';
import type { IntakeDocumentTemplate } from '@/features/intakeDocuments/intakeDocumentTypes';
import { COMMUNICATION_CHOICES, getIntake2027Fields, INTAKE_2027_FIELDS, MEDIA_CHOICES, type IntakeLegalField } from '@/features/intakeDocuments/intake2027Fields';
import { hasCollectedIntakeOriginal } from '@/features/intakeDocuments/restartIntakeDocumentReview';
export function IntakeLegalDetails2027({ form, templates, onChange, disabled = false }: {
    form: ClientIntakeFormData;
    templates: IntakeDocumentTemplate[];
    onChange(form: ClientIntakeFormData): void;
    disabled?: boolean;
}) {
    const id = useId();
    const values = form.intakeLegalDetails ?? {};
    const locked = disabled || form.intakeDocuments.some(hasCollectedIntakeOriginal);
    const keys = templates.map(template => template.templateKey);
    const fields = getIntake2027Fields(keys, form);
    const templateFields = new Set(Object.values(INTAKE_2027_FIELDS).flat().map(item => item.key));
    const change = (key: string, value: string) => onChange({ ...form, intakeLegalDetails: { ...values, [key]: value,
            ...(key === 'signer.capacity' && value === 'Die betreute Person selbst' ? { 'signer.name': `${form.firstName} ${form.lastName}`.trim() } : {}) } });
    const input = (item: IntakeLegalField) => <NativeLabel className="cs-legal-field" key={item.key} htmlFor={`${id}-${item.key}`}>
    <NativeSpan>{item.label}{!item.optional ? <NativeSmall> erforderlich</NativeSmall> : null}</NativeSpan>
    {item.choices && ['signer.capacity', 'contract.conclusion', 'consulting.basis'].includes(item.key)
            ? <NativeSelect id={`${id}-${item.key}`} value={values[item.key] ?? ''} disabled={locked} onChange={event => change(item.key, event.target.value)}><NativeOption value="">Bitte auswählen</NativeOption>{item.choices.map(choice => <NativeOption key={choice}>{choice}</NativeOption>)}</NativeSelect>
            : <NativeTextarea id={`${id}-${item.key}`} rows={item.key.startsWith('provider.') || templateFields.has(item.key) ? 3 : 2} value={values[item.key] ?? ''} maxLength={10000} disabled={locked} onChange={event => change(item.key, event.target.value)} aria-describedby={item.help ? `${id}-${item.key}-help` : undefined}/>}
    {item.help ? <NativeSpan id={`${id}-${item.key}-help`} className="cs-legal-help">{item.help}</NativeSpan> : null}
    {item.choices && !['signer.capacity', 'contract.conclusion', 'consulting.basis'].includes(item.key) ? <NativeSpan className="cs-legal-quick">{item.choices.map(choice => <NativeButton type="button" key={choice} disabled={locked} onClick={() => change(item.key, choice)}>{choice}</NativeButton>)}</NativeSpan> : null}
  </NativeLabel>;
    const choiceList = (choices: readonly {
        key: string;
        label: string;
        help?: string;
    }[]) => <NativeDiv className="cs-legal-choices">{choices.map(choice => <NativeLabel key={choice.key}><NativeInput type="checkbox" checked={values[choice.key] === 'yes'} disabled={locked} onChange={event => change(choice.key, event.target.checked ? 'yes' : '')}/><NativeSpan>{choice.label}{choice.help ? <NativeSmall>{choice.help}</NativeSmall> : null}</NativeSpan></NativeLabel>)}</NativeDiv>;
    const filled = fields.filter(item => values[item.key]?.trim()).length;
    return <NativeSection className="cs-legal-editor" aria-label="Individuelle Vereinbarungen 2027"><NativeHeader><NativeDiv><NativeSpan className="cs-legal-eyebrow">Ausgabe 2027</NativeSpan><NativeH3>Das wird wirklich vereinbart</NativeH3><NativeP>Die Angaben erscheinen unmittelbar im Dokument. Freiwillige Einwilligungen werden einzeln ausgewählt.</NativeP></NativeDiv><NativeSpan className="cs-legal-progress">{filled} / {fields.length} Angaben</NativeSpan></NativeHeader>
    {form.intakeDocuments.some(hasCollectedIntakeOriginal) ? <NativeP className="cs-contract-notice">Diese Angaben gehören zu einer bereits unterschriebenen Fassung. Für Änderungen zuerst eine neue Fassung beginnen; das Original bleibt erhalten.</NativeP> : null}
    <NativeDetails className="cs-legal-group" open><NativeSummary><NativeSpan>Unternehmen, Datenschutz und Unterschreibende</NativeSpan><NativeSpan>{fields.filter(item => !templateFields.has(item.key)).length} Angaben</NativeSpan></NativeSummary><NativeDiv className="cs-legal-fields">{fields.filter(item => !templateFields.has(item.key)).map(input)}</NativeDiv></NativeDetails>
    {templates.filter(template => (INTAKE_2027_FIELDS[template.templateKey]?.length ?? 0) > 0 || ['communication_consent_default', 'photo_media_consent_default'].includes(template.templateKey)).map(template => <NativeDetails key={template.templateKey} className="cs-legal-group"><NativeSummary><NativeSpan>{template.title}</NativeSpan><NativeSpan>Vereinbarung öffnen</NativeSpan></NativeSummary>
      {template.templateKey === 'communication_consent_default' ? choiceList(COMMUNICATION_CHOICES) : null}
      {template.templateKey === 'photo_media_consent_default' ? choiceList(MEDIA_CHOICES) : null}
      <NativeDiv className="cs-legal-fields">{(INTAKE_2027_FIELDS[template.templateKey] ?? []).map(input)}</NativeDiv>
    </NativeDetails>)}
  </NativeSection>;
}
