import { useEffect, useState } from 'react';
import type { RoleKey } from '@/types';
import type { CsDocumentClientRecipient, CsDocumentEmployeeRecipient } from '@/types/documents/csDocumentRecipients';
import { searchCsDocumentClientRecipients, searchCsDocumentEmployeeRecipients } from '@/lib/documents/csTemplates/csDocumentRecipientSearchService';

type Recipient = CsDocumentEmployeeRecipient | CsDocumentClientRecipient;
type PickerProps<T extends Recipient> = { tenantId: string; actorRoleKey?: RoleKey | null; selectedId: string | null; onSelect: (recipient: T | null) => void; errorMessage?: string | null };

function RecipientPicker<T extends Recipient>({ kind, ...props }: PickerProps<T> & { kind: 'employee' | 'client' }) {
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    const timer = setTimeout(() => {
      const query = kind === 'employee' ? searchCsDocumentEmployeeRecipients : searchCsDocumentClientRecipients;
      void query(props.tenantId, props.actorRoleKey ?? undefined, search).then((result) => {
        if (!active) return;
        setRows(result.ok ? result.data as T[] : []);
        setError(result.ok ? null : result.error);
      }).catch(() => { if (active) { setRows([]); setError('Die Suche ist fehlgeschlagen. Bitte erneut versuchen.'); } })
        .finally(() => { if (active) setLoading(false); });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [kind, props.tenantId, props.actorRoleKey, search, attempt]);
  return <section>
    <label>{kind === 'employee' ? 'Mitarbeitende suchen' : 'Klient:in suchen'}<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name oder weitere Suchangaben" /></label>
    {props.errorMessage ? <p role="alert" className="ds-notice ds-notice--error">{props.errorMessage}</p> : null}
    {error ? <div role="alert" className="ds-notice ds-notice--error">{error} <button type="button" className="ds-button" onClick={() => setAttempt((value) => value + 1)}>Erneut versuchen</button></div> : null}
    {loading ? <p role="status" className="ds-muted">Empfänger werden gesucht…</p> : null}
    <div className="ds-picker-list" aria-label={kind === 'employee' ? 'Mitarbeitende' : 'Klient:innen'}>
      {rows.map((row) => <button type="button" className="ds-picker-option" key={row.id} aria-pressed={props.selectedId === row.id} onClick={() => props.onSelect(props.selectedId === row.id ? null : row)}>
        <strong>{row.fullName}</strong><small>{'email' in row ? [row.email, row.jobTitle].filter(Boolean).join(' · ') : [row.locationLabel, row.payorName].filter(Boolean).join(' · ')}</small>
        <small>{row.portalLabel}{!row.portalActive ? ' · Zugang vor der Unterschrift erforderlich' : ''}</small>
      </button>)}
      {!loading && !error && rows.length === 0 ? <p className="ds-muted">Keine passenden Personen gefunden. Bitte einen anderen Suchbegriff verwenden.</p> : null}
    </div>
  </section>;
}
export function CsDocumentEmployeeRecipientPicker(props: PickerProps<CsDocumentEmployeeRecipient>) { return <RecipientPicker {...props} kind="employee" />; }
export function CsDocumentClientRecipientPicker(props: PickerProps<CsDocumentClientRecipient>) { return <RecipientPicker {...props} kind="client" />; }
