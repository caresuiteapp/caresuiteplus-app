// Generated native presentation from src/screens/documents/PlaceholderManagementScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {nativeNavigator as navigator} from '@/lib/platform/nativeWorkflowEnvironment.native';
import {NativeStyle,NativeDiv,NativeButton,NativeStrong,NativeP,NativeSpan,NativeLabel,NativeInput,NativeSelect,NativeOption,NativeH2,NativeSection,NativeArticle,NativeH3,NativeCode,NativeDetails,NativeSummary,NativeDl,NativeDt,NativeDd} from '@/components/layout/NativeWorkspaceElements.native';
import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { DocumentsWorkspaceShell } from "../../components/documents/DocumentsWorkspaceShell.native.tsx";
import { formatPlaceholderToken, getRequiredDocumentTypesForField, getRequiredFieldLabel, SYSTEM_PLACEHOLDER_SEEDS, type PlaceholderGroup, } from '@/features/documents/templateEngine';
import { usePlaceholderRegistry } from '@/hooks/documents/usePlaceholderRegistry';
import { usePermissions } from '@/hooks/usePermissions';
import { TEMPLATE_VARIABLES, type TemplateVariableDefinition } from '@/lib/templates/templateVariables';
const GROUP_DESCRIPTIONS: Record<PlaceholderGroup, string> = {
    company: 'Name, Anschrift und Angaben Ihres Unternehmens',
    client: 'Angaben aus der Klientenakte',
    representative: 'Daten der hinterlegten Vertretung',
    cost_carrier: 'Angaben zum zuständigen Kostenträger',
    recipient: 'Empfänger des jeweiligen Dokuments',
    invoice: 'Rechnungsdaten und Zahlungsangaben',
    visit: 'Angaben zum Einsatz und Leistungsnachweis',
    contract: 'Vereinbarungen und Vertragsdaten',
    signature: 'Angaben zur geleisteten Unterschrift',
    document: 'Inhalt, Erstellung und Version des Dokuments',
    page: 'Seitennummerierung im fertigen Dokument',
};
type TextFieldGroup = TemplateVariableDefinition['group'];
const TEXT_GROUP_LABELS: Record<TextFieldGroup, string> = {
    tenant: 'Unternehmen & Einrichtung', company: 'Unternehmen', client: 'Klient:innen', employee: 'Mitarbeitende',
    appointment: 'Termine & Zeiträume', document: 'Dokument', billing: 'Abrechnung', message: 'Nachrichten',
    care: 'Pflege & Leistungen', communication: 'Kommunikation', course: 'Kurse', clinical: 'Gesundheit & Versorgung', general: 'Allgemeine Angaben',
};
const TEXT_GROUP_OPTIONS = (Object.keys(TEXT_GROUP_LABELS) as TextFieldGroup[])
    .filter((key) => TEMPLATE_VARIABLES.some((entry) => entry.group === key))
    .map((key) => ({ key, label: TEXT_GROUP_LABELS[key] }));
type FieldEntry = {
    key: string;
    token: string;
    label: string;
    group: string;
    description?: string;
    example?: string;
    origin: string;
    required: string[];
};
const css = `
.dph-switch{display:flex;gap:8px;flex-wrap:wrap}.dph-switch .dw-button[aria-pressed=true]{color:#1859b3;background:#e6f0ff;border-color:#a6c6ed}.dph-intro{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:22px 26px;background:linear-gradient(115deg,#fff,#f0f6ff);border:1px solid #dce7f4;border-radius:20px}.dph-intro p{margin:5px 0 0;color:#526681;line-height:1.55;max-width:760px}.dph-intro strong{color:#173353;font-size:16px}.dph-summary{white-space:nowrap;color:#295ead;font-size:14px;background:#e5efff;border:1px solid #ccdff8;border-radius:14px;padding:10px 14px}.dph-filters{display:grid;grid-template-columns:minmax(0,1fr) minmax(180px,260px);gap:14px;align-items:end}.dph-groups{display:grid;gap:28px}.dph-group-heading{display:flex;justify-content:space-between;align-items:center;gap:14px;margin:0 0 12px}.dph-group-heading h2{font-size:18px;margin:0;color:#173353}.dph-group-heading p{font-size:13px;margin:5px 0 0;color:#526681}.dph-cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.dph-entry{min-width:0;padding:19px 21px;border:1px solid #dbe5f0;border-radius:18px;background:#fff;box-shadow:0 3px 12px #244b7810;transition:box-shadow .18s,border-color .18s,transform .18s}.dph-entry:hover{border-color:#bed2ee;box-shadow:0 7px 21px #244b7817;transform:translateY(-2px)}.dph-entry-top{display:flex;align-items:start;justify-content:space-between;gap:12px}.dph-entry h3{margin:0;color:#1d3656;font-size:15px;line-height:1.4}.dph-entry p{font-size:13px;color:#526681;line-height:1.5;margin:8px 0}.dph-token-row{display:flex;align-items:center;gap:10px;margin-top:13px}.dph-token{min-width:0;flex:1;display:block;overflow-wrap:anywhere;user-select:all;border:1px solid #dce6f3;background:#f2f6fc;padding:10px 12px;border-radius:10px;color:#23569b;font-size:12px;line-height:1.55}.dph-token-row .dw-button{padding:8px 12px;min-height:38px;flex-shrink:0}.dph-entry details{margin-top:13px;font-size:12px;color:#526681}.dph-entry summary{cursor:pointer;width:fit-content;border-radius:4px}.dph-entry summary:focus-visible{outline:3px solid #93b8ed;outline-offset:4px}.dph-entry dl{display:grid;grid-template-columns:auto minmax(0,1fr);gap:8px 12px;margin:12px 0 0;line-height:1.5}.dph-entry dt{color:#64758b}.dph-entry dd{margin:0;overflow-wrap:anywhere}.dph-results{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;color:#526681;font-size:13px}.dph-entry .dw-status{font-size:11px}.dph-copy-status{margin:0}.dph-layout{display:grid;gap:22px}
@container (max-width:760px){.dph-cards{grid-template-columns:1fr}.dph-intro{align-items:flex-start;flex-direction:column}.dph-filters{grid-template-columns:1fr}.dph-summary{white-space:normal}}
@media(prefers-reduced-motion:reduce){.dph-entry{transition:none}.dph-entry:hover{transform:none}}
`.replace(/font-size:(\d+)px/g, 'font-size:calc($1px * var(--app-font-scale,1))');
export function PlaceholderManagementScreen() {
    const router = useRouter();
    const { can, check } = usePermissions();
    const canView = can('office.catalogs.view') || can('settings.templates.view');
    const { query, setQuery, group, setGroup, entries, groupOptions } = usePlaceholderRegistry();
    const [mode, setMode] = useState<'text' | 'document'>('text');
    const [textGroup, setTextGroup] = useState<TextFieldGroup | 'all'>('all');
    const [copyFeedback, setCopyFeedback] = useState<{
        message: string;
        failed: boolean;
    } | null>(null);
    const [copying, setCopying] = useState<string | null>(null);
    const isText = mode === 'text';
    const activeGroup = isText ? textGroup : group;
    const options = isText ? [{ key: 'all', label: 'Alle Bereiche' }, ...TEXT_GROUP_OPTIONS] : groupOptions;
    const visibleEntries = useMemo<FieldEntry[]>(() => {
        if (mode === 'document')
            return entries.map((entry) => ({
                key: entry.key, token: formatPlaceholderToken(entry.key), label: entry.label, group: entry.group,
                description: entry.description, example: entry.exampleValue, origin: GROUP_DESCRIPTIONS[entry.group],
                required: getRequiredDocumentTypesForField(entry.key).map(getRequiredFieldLabel),
            }));
        const search = query.trim().toLocaleLowerCase('de');
        return TEMPLATE_VARIABLES.filter((entry) => (textGroup === 'all' || entry.group === textGroup) &&
            (!search || [entry.key, entry.label, entry.example, TEXT_GROUP_LABELS[entry.group]].join(' ').toLocaleLowerCase('de').includes(search)))
            .map((entry) => ({ key: entry.key, token: `{{${entry.key}}}`, label: entry.label, group: entry.group,
            example: entry.example, origin: TEXT_GROUP_LABELS[entry.group], required: [] }));
    }, [entries, mode, query, textGroup]);
    const groups = options.filter((option) => option.key !== 'all').map((option) => ({
        key: option.key, label: option.key === 'document' ? 'Dokument' : option.label,
        description: isText ? `Felder für ${option.label}` : GROUP_DESCRIPTIONS[option.key as PlaceholderGroup],
        entries: visibleEntries.filter((entry) => entry.group === option.key),
    })).filter((item) => item.entries.length > 0);
    const copy = async (token: string) => {
        if (!canView || copying)
            return;
        setCopying(token);
        setCopyFeedback(null);
        try {
            if (!navigator.clipboard?.writeText)
                throw new Error('clipboard-unavailable');
            await navigator.clipboard.writeText(token);
            setCopyFeedback({ message: `Platzhalter ${token} kopiert.`, failed: false });
        }
        catch {
            setCopyFeedback({ message: 'Kopieren ist in diesem Browser nicht möglich. Markieren Sie den Platzhalter und kopieren Sie ihn mit Strg+C oder ⌘C.', failed: true });
        }
        finally {
            setCopying(null);
        }
    };
    return (<DocumentsWorkspaceShell active="settings" title="Automatische Felder" description="Passende Felder für Textvorlagen finden und Dokumentfelder nachschlagen." back={{ label: 'Vorlageneinstellungen', onClick: () => router.push('/business/templates/documents-hub' as never) }}>
      <NativeStyle>{css}</NativeStyle>
      {!canView ? <NativeDiv className="dw-alert" data-tone="danger" role="alert">{check('office.catalogs.view').reason ?? 'Sie dürfen die automatischen Felder nicht ansehen.'}</NativeDiv> : (<NativeDiv className="dph-layout">
          <NativeDiv className="dph-switch" role="group" aria-label="Vorlagenart">
            <NativeButton className="dw-button" type="button" aria-pressed={isText} disabled={copying !== null} onClick={() => { setMode('text'); setCopyFeedback(null); }}>Textvorlagen</NativeButton>
            <NativeButton className="dw-button" type="button" aria-pressed={!isText} disabled={copying !== null} onClick={() => { setMode('document'); setCopyFeedback(null); }}>Dokumentfelder</NativeButton>
          </NativeDiv>
          <NativeDiv className="dph-intro">
            <NativeDiv><NativeStrong>{isText ? 'Felder für Ihre Textvorlagen' : 'Referenz für vorhandene Dokumentvorlagen'}</NativeStrong><NativeP>{isText ? 'Kopieren Sie ein Feld in den Texteditor oder wählen Sie es dort unter „Angabe einfügen“. Welche Angaben ausgefüllt werden, hängt vom jeweiligen Vorgang ab. Die Beispiele zeigen nur das Format.' : 'Diese Felder gehören zu vorhandenen Dokumentvorlagen. Sie dienen hier zum Nachschlagen und sind für den Textvorlagen-Editor nicht vorgesehen. Die Beispiele zeigen nur das Format.'}</NativeP></NativeDiv>
            <NativeSpan className="dph-summary">{isText ? TEMPLATE_VARIABLES.length : SYSTEM_PLACEHOLDER_SEEDS.length} verfügbare Felder</NativeSpan>
          </NativeDiv>
          <NativeDiv className="dph-filters">
            <NativeLabel className="dw-field"><NativeSpan className="dw-label">Feld suchen</NativeSpan><NativeInput className="dw-input" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Zum Beispiel Name, Anschrift oder Rechnungsnummer"/></NativeLabel>
            <NativeLabel className="dw-field"><NativeSpan className="dw-label">Datenbereich</NativeSpan><NativeSelect className="dw-select" value={activeGroup} onChange={(event) => isText ? setTextGroup(event.target.value as TextFieldGroup | 'all') : setGroup(event.target.value as PlaceholderGroup | 'all')}>{options.map((option) => <NativeOption key={option.key} value={option.key}>{option.key === 'document' ? 'Dokument' : option.key === 'all' ? 'Alle Bereiche' : option.label}</NativeOption>)}</NativeSelect></NativeLabel>
          </NativeDiv>
          <NativeDiv className="dph-results"><NativeSpan aria-live="polite">{visibleEntries.length} {visibleEntries.length === 1 ? 'Feld' : 'Felder'} in {groups.length} {groups.length === 1 ? 'Bereich' : 'Bereichen'}</NativeSpan>{query || activeGroup !== 'all' ? <NativeButton type="button" className="dw-button dw-button--quiet" onClick={() => { setQuery(''); if (isText)
            setTextGroup('all');
        else
            setGroup('all'); }}>Filter zurücksetzen</NativeButton> : null}</NativeDiv>
          {copyFeedback ? <NativeP className="dw-alert dph-copy-status" data-tone={copyFeedback.failed ? 'danger' : 'success'} role={copyFeedback.failed ? 'alert' : 'status'}>{copyFeedback.message}</NativeP> : null}
          {visibleEntries.length === 0 ? <NativeDiv className="dw-empty"><NativeH2>Kein passendes Feld gefunden</NativeH2><NativeP>Versuchen Sie einen anderen Suchbegriff oder wählen Sie alle Datenbereiche.</NativeP></NativeDiv> : <NativeDiv className="dph-groups">{groups.map((item) => (<NativeSection key={`${mode}-${item.key}`} aria-labelledby={`dph-${mode}-${item.key}`}>
              <NativeDiv className="dph-group-heading"><NativeDiv><NativeH2 id={`dph-${mode}-${item.key}`}>{item.label}</NativeH2><NativeP>{item.description}</NativeP></NativeDiv><NativeSpan className="dw-chip">{item.entries.length}</NativeSpan></NativeDiv>
              <NativeDiv className="dph-cards">{item.entries.map((entry) => <NativeArticle className="dph-entry" key={entry.key}>
                <NativeDiv className="dph-entry-top"><NativeH3>{entry.label}</NativeH3>{entry.required.length > 0 ? <NativeSpan className="dw-status" data-tone="warning">Pflichtfeld</NativeSpan> : null}</NativeDiv>
                {entry.description ? <NativeP>{entry.description}</NativeP> : null}
                <NativeDiv className="dph-token-row"><NativeCode className="dph-token">{entry.token}</NativeCode><NativeButton type="button" className="dw-button dw-button--quiet" disabled={copying !== null} onClick={() => void copy(entry.token)} aria-label={`${entry.label}: Platzhalter kopieren`}>{copying === entry.token ? 'Wird kopiert …' : 'Kopieren'}</NativeButton></NativeDiv>
                <NativeDetails><NativeSummary>Verwendung & Beispiel</NativeSummary><NativeDl><NativeDt>Beispiel</NativeDt><NativeDd>{entry.example || 'Abhängig vom ausgewählten Vorgang'}</NativeDd><NativeDt>Datenbereich</NativeDt><NativeDd>{entry.origin}</NativeDd><NativeDt>Verwendung</NativeDt><NativeDd>{entry.required.length ? `Erforderlich für: ${entry.required.join(', ')}` : isText ? 'Für eigene Textvorlagen' : 'Feld in vorhandenen Dokumentvorlagen'}</NativeDd></NativeDl></NativeDetails>
              </NativeArticle>)}</NativeDiv>
            </NativeSection>))}</NativeDiv>}
        </NativeDiv>)}
    </DocumentsWorkspaceShell>);
}
