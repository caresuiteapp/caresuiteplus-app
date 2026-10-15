import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { DocumentsWorkspaceShell } from '@/components/documents/DocumentsWorkspaceShell.web';
import {
  formatPlaceholderToken,
  getRequiredDocumentTypesForField,
  getRequiredFieldLabel,
  SYSTEM_PLACEHOLDER_SEEDS,
  type PlaceholderGroup,
} from '@/features/documents/templateEngine';
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
type FieldEntry = { key: string; token: string; label: string; group: string; description?: string; example?: string; origin: string; required: string[] };

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
  const [copyFeedback, setCopyFeedback] = useState<{ message: string; failed: boolean } | null>(null);
  const [copying, setCopying] = useState<string | null>(null);
  const isText = mode === 'text';
  const activeGroup = isText ? textGroup : group;
  const options = isText ? [{ key: 'all', label: 'Alle Bereiche' }, ...TEXT_GROUP_OPTIONS] : groupOptions;
  const visibleEntries = useMemo<FieldEntry[]>(() => {
    if (mode === 'document') return entries.map((entry) => ({
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
    if (!canView || copying) return;
    setCopying(token);
    setCopyFeedback(null);
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard-unavailable');
      await navigator.clipboard.writeText(token);
      setCopyFeedback({ message: `Platzhalter ${token} kopiert.`, failed: false });
    } catch {
      setCopyFeedback({ message: 'Kopieren ist in diesem Browser nicht möglich. Markieren Sie den Platzhalter und kopieren Sie ihn mit Strg+C oder ⌘C.', failed: true });
    } finally {
      setCopying(null);
    }
  };

  return (
    <DocumentsWorkspaceShell active="settings" title="Automatische Felder" description="Passende Felder für Textvorlagen finden und Dokumentfelder nachschlagen." back={{ label: 'Vorlageneinstellungen', onClick: () => router.push('/business/templates/documents-hub' as never) }}>
      <style>{css}</style>
      {!canView ? <div className="dw-alert" data-tone="danger" role="alert">{check('office.catalogs.view').reason ?? 'Sie dürfen die automatischen Felder nicht ansehen.'}</div> : (
        <div className="dph-layout">
          <div className="dph-switch" role="group" aria-label="Vorlagenart">
            <button className="dw-button" type="button" aria-pressed={isText} disabled={copying !== null} onClick={() => { setMode('text'); setCopyFeedback(null); }}>Textvorlagen</button>
            <button className="dw-button" type="button" aria-pressed={!isText} disabled={copying !== null} onClick={() => { setMode('document'); setCopyFeedback(null); }}>Dokumentfelder</button>
          </div>
          <div className="dph-intro">
            <div><strong>{isText ? 'Felder für Ihre Textvorlagen' : 'Referenz für vorhandene Dokumentvorlagen'}</strong><p>{isText ? 'Kopieren Sie ein Feld in den Texteditor oder wählen Sie es dort unter „Angabe einfügen“. Welche Angaben ausgefüllt werden, hängt vom jeweiligen Vorgang ab. Die Beispiele zeigen nur das Format.' : 'Diese Felder gehören zu vorhandenen Dokumentvorlagen. Sie dienen hier zum Nachschlagen und sind für den Textvorlagen-Editor nicht vorgesehen. Die Beispiele zeigen nur das Format.'}</p></div>
            <span className="dph-summary">{isText ? TEMPLATE_VARIABLES.length : SYSTEM_PLACEHOLDER_SEEDS.length} verfügbare Felder</span>
          </div>
          <div className="dph-filters">
            <label className="dw-field"><span className="dw-label">Feld suchen</span><input className="dw-input" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Zum Beispiel Name, Anschrift oder Rechnungsnummer" /></label>
            <label className="dw-field"><span className="dw-label">Datenbereich</span><select className="dw-select" value={activeGroup} onChange={(event) => isText ? setTextGroup(event.target.value as TextFieldGroup | 'all') : setGroup(event.target.value as PlaceholderGroup | 'all')}>{options.map((option) => <option key={option.key} value={option.key}>{option.key === 'document' ? 'Dokument' : option.key === 'all' ? 'Alle Bereiche' : option.label}</option>)}</select></label>
          </div>
          <div className="dph-results"><span aria-live="polite">{visibleEntries.length} {visibleEntries.length === 1 ? 'Feld' : 'Felder'} in {groups.length} {groups.length === 1 ? 'Bereich' : 'Bereichen'}</span>{query || activeGroup !== 'all' ? <button type="button" className="dw-button dw-button--quiet" onClick={() => { setQuery(''); if (isText) setTextGroup('all'); else setGroup('all'); }}>Filter zurücksetzen</button> : null}</div>
          {copyFeedback ? <p className="dw-alert dph-copy-status" data-tone={copyFeedback.failed ? 'danger' : 'success'} role={copyFeedback.failed ? 'alert' : 'status'}>{copyFeedback.message}</p> : null}
          {visibleEntries.length === 0 ? <div className="dw-empty"><h2>Kein passendes Feld gefunden</h2><p>Versuchen Sie einen anderen Suchbegriff oder wählen Sie alle Datenbereiche.</p></div> : <div className="dph-groups">{groups.map((item) => (
            <section key={`${mode}-${item.key}`} aria-labelledby={`dph-${mode}-${item.key}`}>
              <div className="dph-group-heading"><div><h2 id={`dph-${mode}-${item.key}`}>{item.label}</h2><p>{item.description}</p></div><span className="dw-chip">{item.entries.length}</span></div>
              <div className="dph-cards">{item.entries.map((entry) => <article className="dph-entry" key={entry.key}>
                <div className="dph-entry-top"><h3>{entry.label}</h3>{entry.required.length > 0 ? <span className="dw-status" data-tone="warning">Pflichtfeld</span> : null}</div>
                {entry.description ? <p>{entry.description}</p> : null}
                <div className="dph-token-row"><code className="dph-token">{entry.token}</code><button type="button" className="dw-button dw-button--quiet" disabled={copying !== null} onClick={() => void copy(entry.token)} aria-label={`${entry.label}: Platzhalter kopieren`}>{copying === entry.token ? 'Wird kopiert …' : 'Kopieren'}</button></div>
                <details><summary>Verwendung & Beispiel</summary><dl><dt>Beispiel</dt><dd>{entry.example || 'Abhängig vom ausgewählten Vorgang'}</dd><dt>Datenbereich</dt><dd>{entry.origin}</dd><dt>Verwendung</dt><dd>{entry.required.length ? `Erforderlich für: ${entry.required.join(', ')}` : isText ? 'Für eigene Textvorlagen' : 'Feld in vorhandenen Dokumentvorlagen'}</dd></dl></details>
              </article>)}</div>
            </section>
          ))}</div>}
        </div>
      )}
    </DocumentsWorkspaceShell>
  );
}
