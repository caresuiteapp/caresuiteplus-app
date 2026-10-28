// Generated native presentation from src/components/office/documentSignatures/CsDocumentRecipientPicker.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeSection,NativeLabel,NativeInput,NativeP,NativeDiv,NativeButton,NativeStrong,NativeSmall} from '@/components/layout/NativeWorkspaceElements.native';
import { useEffect, useState } from 'react';
import type { RoleKey } from '@/types';
import type { CsDocumentClientRecipient, CsDocumentEmployeeRecipient } from '@/types/documents/csDocumentRecipients';
import { searchCsDocumentClientRecipients, searchCsDocumentEmployeeRecipients } from '@/lib/documents/csTemplates/csDocumentRecipientSearchService';
type Recipient = CsDocumentEmployeeRecipient | CsDocumentClientRecipient;
type PickerProps<T extends Recipient> = {
    tenantId: string;
    actorRoleKey?: RoleKey | null;
    selectedId: string | null;
    onSelect: (recipient: T | null) => void;
    errorMessage?: string | null;
};
function RecipientPicker<T extends Recipient>({ kind, ...props }: PickerProps<T> & {
    kind: 'employee' | 'client';
}) {
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
                if (!active)
                    return;
                setRows(result.ok ? result.data as T[] : []);
                setError(result.ok ? null : result.error);
            }).catch(() => { if (active) {
                setRows([]);
                setError('Die Suche ist fehlgeschlagen. Bitte erneut versuchen.');
            } })
                .finally(() => { if (active)
                setLoading(false); });
        }, 250);
        return () => { active = false; clearTimeout(timer); };
    }, [kind, props.tenantId, props.actorRoleKey, search, attempt]);
    return <NativeSection>
    <NativeLabel>{kind === 'employee' ? 'Mitarbeitende suchen' : 'Klient:in suchen'}<NativeInput type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name oder weitere Suchangaben"/></NativeLabel>
    {props.errorMessage ? <NativeP role="alert" className="ds-notice ds-notice--error">{props.errorMessage}</NativeP> : null}
    {error ? <NativeDiv role="alert" className="ds-notice ds-notice--error">{error} <NativeButton type="button" className="ds-button" onClick={() => setAttempt((value) => value + 1)}>Erneut versuchen</NativeButton></NativeDiv> : null}
    {loading ? <NativeP role="status" className="ds-muted">Empfänger werden gesucht…</NativeP> : null}
    <NativeDiv className="ds-picker-list" aria-label={kind === 'employee' ? 'Mitarbeitende' : 'Klient:innen'}>
      {rows.map((row) => <NativeButton type="button" className="ds-picker-option" key={row.id} aria-pressed={props.selectedId === row.id} onClick={() => props.onSelect(props.selectedId === row.id ? null : row)}>
        <NativeStrong>{row.fullName}</NativeStrong><NativeSmall>{'email' in row ? [row.email, row.jobTitle].filter(Boolean).join(' · ') : [row.locationLabel, row.payorName].filter(Boolean).join(' · ')}</NativeSmall>
        <NativeSmall>{row.portalLabel}{!row.portalActive ? ' · Zugang vor der Unterschrift erforderlich' : ''}</NativeSmall>
      </NativeButton>)}
      {!loading && !error && rows.length === 0 ? <NativeP className="ds-muted">Keine passenden Personen gefunden. Bitte einen anderen Suchbegriff verwenden.</NativeP> : null}
    </NativeDiv>
  </NativeSection>;
}
export function CsDocumentEmployeeRecipientPicker(props: PickerProps<CsDocumentEmployeeRecipient>) { return <RecipientPicker {...props} kind="employee"/>; }
export function CsDocumentClientRecipientPicker(props: PickerProps<CsDocumentClientRecipient>) { return <RecipientPicker {...props} kind="client"/>; }
