import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClientContactRecord, ClientPortalCredentialsReveal } from '@/types/modules/client';
import { listAcademyFamilyAccess, manageAcademyFamilyAccess, type AcademyFamilyAccess } from '@/lib/clients/academyFamilyAccessService';
import { copyTextToClipboard } from '@/lib/platform/clipboard';

type Props = { tenantId: string; clientId: string; contacts: ClientContactRecord[]; isReadOnly: boolean; onRefresh?: () => void };
export function AcademyFamilyAccessPanel(props: Props) {
  return <FamilyAccessContent key={`${props.tenantId}:${props.clientId}`} {...props} />;
}
function FamilyAccessContent({ tenantId, clientId, contacts, isReadOnly, onRefresh }: Props) {
  const alive = useRef(true);
  const lock = useRef(false);
  const [rows, setRows] = useState<AcademyFamilyAccess[]>([]);
  const [ready, setReady] = useState(false);
  const [contactId, setContactId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [messageError, setMessageError] = useState(false);
  const [credentials, setCredentials] = useState<ClientPortalCredentialsReveal | null>(null);
  const [credentialOwner, setCredentialOwner] = useState('');
  const available = contacts.filter(contact => contact.contactType === 'relative' || ['angehoerige', 'ehepartner', 'kind', 'betreuer'].includes(contact.relationship));
  const load = useCallback(async () => {
    if (lock.current) return;
    lock.current = true; setLoading(true); setError('');
    try { const result = await listAcademyFamilyAccess(tenantId, clientId); if (alive.current) { setRows(result.accesses); setReady(result.ready); } }
    catch (e) { if (alive.current) setError(e instanceof Error ? e.message : 'Die Zugänge konnten nicht geladen werden.'); }
    finally { lock.current = false; if (alive.current) setLoading(false); }
  }, [tenantId, clientId]);
  useEffect(() => { alive.current = true; void load(); return () => { alive.current = false; }; }, [load]);
  async function act(action: 'setup' | 'rotate' | 'enable' | 'disable', row?: AcademyFamilyAccess) {
    if (isReadOnly || lock.current || error || (!ready && action !== 'disable')) return;
    const targetContactId = row?.contactId ?? contactId;
    const contact = contacts.find(value => value.id === targetContactId);
    if (action !== 'disable' && !contact) { setError('Der verknüpfte Kontakt ist nicht mehr vorhanden. Bitte die Klientenakte aktualisieren.'); return; }
    lock.current = true; setBusy(true); setCredentials(null); setMessage(''); setMessageError(false); setError('');
    try {
      const result = await manageAcademyFamilyAccess({ tenantId, clientId, contactId: row ? row.contactId : contactId, accountId: row?.id, action,
        firstName: contact?.firstName, lastName: contact?.lastName });
      if (!alive.current) return;
      setRows(previous => [...previous.filter(value => value.id !== result.access.id), result.access]);
      setCredentials(result.credentials); setCredentialOwner(contact ? `${contact.firstName} ${contact.lastName}`.trim() : 'Angehörige Person');
      setMessage(action === 'disable' ? 'Der persönliche Akademiezugang ist deaktiviert.' : action === 'enable' ? 'Der persönliche Akademiezugang ist wieder aktiv.' : action === 'rotate' ? 'Der Zugangscode wurde erneuert. Bisherige Sitzungen wurden beendet.' : 'Der persönliche Akademiezugang wurde eingerichtet.');
      onRefresh?.();
    } catch (e) { if (alive.current) setError(e instanceof Error ? e.message : 'Der Vorgang konnte nicht bestätigt werden. Bitte neu laden.'); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  async function copy() {
    if (!credentials) return;
    let copied = false; try { copied = await copyTextToClipboard(`${credentials.username}\n${credentials.accessCode}`); } catch { /* Visible fallback below. */ }
    if (alive.current) { setMessageError(!copied); setMessage(copied ? 'Zugangsdaten kopiert.' : 'Kopieren fehlgeschlagen. Bitte die Angaben markieren und manuell kopieren.'); }
  }
  return <section className="cs-portal-section" aria-label="Akademiezugänge für Angehörige">
    <div className="cs-portal-heading"><div><span className="cs-portal-eyebrow">CareSuite+ Akademie</span><h2>Persönlich lernen als Angehörige:r</h2><p>Ein eigener Zugang verbindet Schulungen und Nachweise mit dem Kontakt in dieser Klientenakte. Nach der ersten Anmeldung kann die Person Kurse zugewiesen bekommen.</p></div><span className="cs-portal-pill">Nur Akademie</span></div>
    <p className="cs-portal-help">Dieser Zugang öffnet persönliche Lerninhalte. Freigaben für Klientendaten werden dabei nicht verändert.</p>
    {loading ? <p role="status">Akademiezugänge werden geladen…</p> : null}
    {!loading && !error && !ready ? <p role="status">Die sichere Angehörigenanmeldung ist auf diesem Server noch nicht freigeschaltet. Bestehende Zugänge können deaktiviert werden.</p> : null}
    {error ? <div className="cs-portal-status error" role="alert">{error} <button type="button" className="cs-portal-button" disabled={busy || loading} onClick={() => void load()}>Zugänge erneut laden</button></div> : null}
    {message ? <div className={`cs-portal-status ${messageError ? 'error' : 'success'}`} role={messageError ? 'alert' : 'status'}>{message}</div> : null}
    {busy ? <p role="status">Zugang wird aktualisiert…</p> : null}
    {!loading && !error && rows.length === 0 ? <p>Noch kein persönlicher Akademiezugang eingerichtet.</p> : null}
    {rows.map(row => { const contact = contacts.find(value => value.id === row.contactId); return <div className="cs-portal-row" key={row.id}>
      <div className="cs-portal-credential"><strong>{contact ? `${contact.firstName} ${contact.lastName}`.trim() : 'Kontakt nicht mehr vorhanden'}</strong><small>{row.username} · {row.enabled && row.status === 'aktiv' && contact ? 'Aktiv' : 'Deaktiviert'}</small></div>
      {!isReadOnly ? <div className="cs-portal-actions"><button type="button" className="cs-portal-button" disabled={busy || loading || !!error || !ready || !contact} onClick={() => void act('rotate', row)}>Code erneuern</button><button type="button" className="cs-portal-button" disabled={busy || loading || !!error || (!row.enabled && (!contact || !ready))} onClick={() => void act(row.enabled ? 'disable' : 'enable', row)}>{row.enabled ? 'Deaktivieren' : 'Aktivieren'}</button></div> : null}
    </div>; })}
    {!isReadOnly ? <div className="cs-portal-credentials"><label htmlFor={`academy-family-${clientId}`}>Angehörigenkontakt auswählen</label><div className="cs-portal-row"><select id={`academy-family-${clientId}`} value={contactId} disabled={busy || loading || !!error || !ready} onChange={event => { setContactId(event.target.value); setCredentials(null); setMessage(''); }} className="cs-portal-button" style={{ minWidth: 0, maxWidth: '100%', flex: '1 1 240px' }}><option value="">Bitte auswählen</option>{available.filter(contact => !rows.some(row => row.contactId === contact.id)).map(contact => <option key={contact.id} value={contact.id}>{contact.firstName} {contact.lastName}</option>)}</select><button type="button" className="cs-portal-button primary" disabled={!contactId || busy || loading || !!error || !ready} onClick={() => void act('setup')}>Akademiezugang einrichten</button></div>{available.length === 0 ? <p>Bitte zuerst einen Angehörigenkontakt in der zentralen Klientenakte anlegen.</p> : null}</div> : null}
    {credentials ? <div className="cs-portal-credentials" aria-label="Neue Akademiezugangsdaten"><p>Zugangsdaten für <strong>{credentialOwner}</strong></p><div className="cs-portal-credential"><small>Benutzername</small><strong>{credentials.username}</strong><small>Zugangscode · nur jetzt sichtbar</small><strong className="cs-portal-code">{credentials.accessCode}</strong></div><div className="cs-portal-actions"><button type="button" className="cs-portal-button" onClick={() => void copy()}>Akademiezugangsdaten kopieren</button><button type="button" className="cs-portal-button" onClick={() => setCredentials(null)}>Zugangsdaten ausblenden</button></div><p><a href="/auth/portal-code-login" target="_blank" rel="noopener noreferrer">Zur Anmeldung mit Benutzername und Code</a></p></div> : null}
  </section>;
}
