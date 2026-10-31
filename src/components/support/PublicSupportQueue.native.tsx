// Generated native presentation from src/components/support/PublicSupportQueue.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeSection,NativeStyle,NativeDiv,NativeLabel,NativeSelect,NativeOption,NativeButton,NativeP,NativeStrong,NativeSpan,NativeSmall,NativeH3,NativeBr,NativeA,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import { useEffect, useState } from 'react';
import { supportRpc } from "../../lib/support/supportService.native.ts";
type Ticket = {
    id: string;
    reference: string;
    name: string;
    email: string;
    organization: string;
    subject: string;
    category: string;
    message: string;
    status: string;
    created_at: string;
};
const statuses = { open: 'Offen', in_progress: 'In Bearbeitung', resolved: 'Gelöst', closed: 'Geschlossen' };
export function PublicSupportQueue({ canWrite }: {
    canWrite: boolean;
}) {
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [filter, setFilter] = useState('');
    const [offset, setOffset] = useState(0);
    const [selected, setSelected] = useState<Ticket | null>(null);
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [revision, setRevision] = useState(0);
    useEffect(() => {
        let active = true;
        setLoading(true);
        setError(null);
        void supportRpc<{
            tickets: Ticket[];
        }>('support_list_public_tickets', { p_status: filter, p_offset: offset })
            .then(result => { if (active) {
            setTickets(result.tickets);
            setSelected(current => current ? result.tickets.find(row => row.id === current.id) ?? null : null);
        } })
            .catch(cause => { if (active) {
            setTickets([]);
            setSelected(null);
            setError(cause instanceof Error ? cause.message : 'Die öffentlichen Tickets konnten nicht geladen werden.');
        } })
            .finally(() => { if (active)
            setLoading(false); });
        return () => { active = false; };
    }, [filter, offset, revision]);
    const changeStatus = async (status: string) => {
        if (!selected || busy)
            return;
        setBusy(true);
        setError(null);
        try {
            const confirmed = await supportRpc<boolean>('support_set_public_ticket_status', { p_ticket_id: selected.id, p_status: status });
            if (confirmed !== true)
                throw new Error('Die Statusänderung konnte nicht bestätigt werden.');
            setRevision(value => value + 1);
        }
        catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Status konnte nicht gespeichert werden.');
        }
        finally {
            setBusy(false);
        }
    };
    return <NativeWorkspaceStyleScope css={[`.cs-public-queue{min-height:0;flex:1;overflow:auto;padding:20px;color:#e8f2ff}.cs-public-queue .columns{display:grid;grid-template-columns:minmax(230px,.9fr) minmax(0,1.5fr);gap:20px}.cs-public-queue .controls{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px}.cs-public-queue button,.cs-public-queue select{font:inherit;color:#dceaff;background:#102039;border:1px solid #365b84;border-radius:10px;padding:10px 13px}.cs-public-queue button{cursor:pointer}.cs-public-queue button:disabled{opacity:.6;cursor:wait}.cs-public-queue .ticket{display:block;width:100%;text-align:left;margin-bottom:10px;overflow-wrap:anywhere}.cs-public-queue .ticket[aria-pressed=true]{border-color:#83caff;background:#153657}.cs-public-queue .detail{padding:22px;background:#102039;border:1px solid #315781;border-radius:18px;min-width:0;overflow-wrap:anywhere}.cs-public-queue .message{white-space:pre-wrap;line-height:1.7}.cs-public-queue p{line-height:1.6}.cs-public-queue a{color:#93d4ff}.cs-public-queue .error{padding:14px;border:1px solid #d46a7e;border-radius:12px;color:#ffd0d8;margin-bottom:15px}@media(max-width:850px){.cs-public-queue .columns{grid-template-columns:minmax(0,1fr)}}`, `.cs-public-queue{min-height:0;flex:1;overflow:auto;padding:20px;color:#e8f2ff}.cs-public-queue .columns{display:grid;grid-template-columns:minmax(230px,.9fr) minmax(0,1.5fr);gap:20px}.cs-public-queue .controls{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px}.cs-public-queue button,.cs-public-queue select{font:inherit;color:#dceaff;background:#102039;border:1px solid #365b84;border-radius:10px;padding:10px 13px}.cs-public-queue button{cursor:pointer}.cs-public-queue button:disabled{opacity:.6;cursor:wait}.cs-public-queue .ticket{display:block;width:100%;text-align:left;margin-bottom:10px;overflow-wrap:anywhere}.cs-public-queue .ticket[aria-pressed=true]{border-color:#83caff;background:#153657}.cs-public-queue .detail{padding:22px;background:#102039;border:1px solid #315781;border-radius:18px;min-width:0;overflow-wrap:anywhere}.cs-public-queue .message{white-space:pre-wrap;line-height:1.7}.cs-public-queue p{line-height:1.6}.cs-public-queue a{color:#93d4ff}.cs-public-queue .error{padding:14px;border:1px solid #d46a7e;border-radius:12px;color:#ffd0d8;margin-bottom:15px}@media(max-width:850px){.cs-public-queue .columns{grid-template-columns:minmax(0,1fr)}}`]}>{<NativeSection className="cs-public-queue" aria-label="Öffentliche Support-Anfragen">
    <NativeStyle>{`.cs-public-queue{min-height:0;flex:1;overflow:auto;padding:20px;color:#e8f2ff}.cs-public-queue .columns{display:grid;grid-template-columns:minmax(230px,.9fr) minmax(0,1.5fr);gap:20px}.cs-public-queue .controls{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px}.cs-public-queue button,.cs-public-queue select{font:inherit;color:#dceaff;background:#102039;border:1px solid #365b84;border-radius:10px;padding:10px 13px}.cs-public-queue button{cursor:pointer}.cs-public-queue button:disabled{opacity:.6;cursor:wait}.cs-public-queue .ticket{display:block;width:100%;text-align:left;margin-bottom:10px;overflow-wrap:anywhere}.cs-public-queue .ticket[aria-pressed=true]{border-color:#83caff;background:#153657}.cs-public-queue .detail{padding:22px;background:#102039;border:1px solid #315781;border-radius:18px;min-width:0;overflow-wrap:anywhere}.cs-public-queue .message{white-space:pre-wrap;line-height:1.7}.cs-public-queue p{line-height:1.6}.cs-public-queue a{color:#93d4ff}.cs-public-queue .error{padding:14px;border:1px solid #d46a7e;border-radius:12px;color:#ffd0d8;margin-bottom:15px}@media(max-width:850px){.cs-public-queue .columns{grid-template-columns:minmax(0,1fr)}}`}</NativeStyle>
    <NativeDiv className="controls"><NativeLabel>Status <NativeSelect aria-label="Öffentliche Tickets nach Status" value={filter} disabled={busy} onChange={event => { setFilter(event.target.value); setOffset(0); }}><NativeOption value="">Alle</NativeOption>{Object.entries(statuses).map(([key, label]) => <NativeOption key={key} value={key}>{label}</NativeOption>)}</NativeSelect></NativeLabel><NativeButton disabled={loading || busy} onClick={() => setRevision(value => value + 1)}>Aktualisieren</NativeButton></NativeDiv>
    {error ? <NativeDiv role="alert" className="error">{error}</NativeDiv> : null}
    <NativeDiv className="columns"><NativeDiv>
      {loading ? <NativeP role="status">Öffentliche Tickets werden geladen …</NativeP> : tickets.length ? tickets.slice(0, 50).map(ticket => <NativeButton key={ticket.id} className="ticket" aria-pressed={selected?.id === ticket.id} onClick={() => setSelected(ticket)}><NativeStrong>{ticket.reference} · {statuses[ticket.status as keyof typeof statuses] ?? ticket.status}</NativeStrong><NativeP>{ticket.subject}</NativeP><NativeSpan>{ticket.name}{ticket.organization ? ` · ${ticket.organization}` : ''}</NativeSpan></NativeButton>) : <NativeP>Keine öffentlichen Anfragen in dieser Ansicht.</NativeP>}
      <NativeDiv className="controls"><NativeButton disabled={loading || busy || offset === 0} onClick={() => setOffset(value => Math.max(0, value - 50))}>Zurück</NativeButton><NativeButton disabled={loading || busy || tickets.length <= 50} onClick={() => setOffset(value => value + 50)}>Weitere</NativeButton></NativeDiv>
    </NativeDiv><NativeDiv className="detail">{selected ? <>
      <NativeSmall>{selected.reference} · {new Date(selected.created_at).toLocaleString('de-DE')}</NativeSmall><NativeH3>{selected.subject}</NativeH3><NativeP>{selected.name}{selected.organization ? <><NativeBr />{selected.organization}</> : null}<NativeBr /><NativeA href={`mailto:${selected.email}`}>{selected.email}</NativeA></NativeP><NativeP className="message">{selected.message}</NativeP>
      <NativeP>Diese Anfrage gewährt keinen Zugriff auf ein Unternehmen. Antworten erfolgen separat an die angegebene Kontaktadresse.</NativeP>
      {canWrite ? <NativeLabel>Status bearbeiten <NativeSelect aria-label="Ticketstatus bearbeiten" disabled={busy} value={selected.status} onChange={event => void changeStatus(event.target.value)}>{Object.entries(statuses).map(([key, label]) => <NativeOption key={key} value={key}>{label}</NativeOption>)}</NativeSelect></NativeLabel> : null}
    </> : <NativeP>Wählen Sie eine Anfrage aus. Kontaktangaben und Beschreibung erscheinen hier.</NativeP>}</NativeDiv></NativeDiv>
  </NativeSection>}</NativeWorkspaceStyleScope>;
}
