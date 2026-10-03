import { useRef, useState } from 'react';
import { Image, Text, View } from 'react-native';
import { usePortalActor, type PortalActor } from '@/hooks/usePortalActor';
import { useAsyncQuery } from '@/hooks/core';
import { CareSignatureModal } from '@/components/inputs/CareSignatureModal';
import { ErrorState, LoadingState, PremiumButton, PremiumInput, SectionPanel } from '@/components/ui';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { fetchMyCareProofs, downloadMyCareProof, fetchMyCareSignature, fetchMyCareTours, signMyCareProof, advanceMyCareTour, advanceMyCareStop, type PortalCareProof } from '@/lib/pflege/carePortalService';
import { isCalendarDate } from '@/lib/pflege/ambulatoryOperationsDomain';
import { berlinCalendarDate } from '@/lib/pflege/careTourWorkflow';
import { formatDate, formatTime } from '@/lib/formatters/dateTimeFormatters';
const labels: Record<string, string> = { submitted: 'Unterschrift offen', signed: 'Unterschrieben · Prüfung steht aus', approved: 'Geprüft und freigegeben', rejected: 'Zurückgewiesen', published: 'Geplant', in_progress: 'In Durchführung', completed: 'Abgeschlossen', planned: 'Geplant', arrived: 'Angekommen', cancelled: 'Abgesagt' };
export function ClientCareProofPanel() {
 const actor = usePortalActor();
 return actor.roleKey === 'client_portal' && actor.isLinkedReady ? <ClientCareProofContent actor={actor} key={`${actor.tenantId}:${actor.clientId}:${actor.actorId}`} /> : null;
}
function ClientCareProofContent({ actor }: { actor: PortalActor }) {
 const { c } = useCareLightPalette();
 const query = useAsyncQuery(fetchMyCareProofs, [], { queryKey: `${actor.tenantId}:${actor.clientId}:${actor.actorId}:my-care-proofs` });
 const [selected, setSelected] = useState<PortalCareProof | null>(null); const [name, setName] = useState(actor.displayName); const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null); const lock = useRef(false);
 const [signatureId, setSignatureId] = useState('');
 const signature = useAsyncQuery(() => fetchMyCareSignature(signatureId), [signatureId], { enabled: !!signatureId, queryKey: `${actor.tenantId}:${actor.clientId}:${actor.actorId}:${signatureId}:my-signature` });
 async function confirm(png: string) {
  if (!selected || lock.current) return; lock.current = true; setBusy(true); setError(null);
  try { const result = await signMyCareProof(selected.id, name, png); if (!result.ok) { const message = result.error === 'PORTAL_CARE_NOT_ELIGIBLE' ? 'Dieser Nachweis kann mit dem aktuellen Portalzugang nicht unterschrieben werden.' : result.error; setError(message); throw new Error(message); } setOpen(false); setSelected(null); await query.refresh(); }
  finally { lock.current = false; setBusy(false); }
 }
 if (query.error === 'PORTAL_CARE_NOT_ELIGIBLE') return null;
 return <SectionPanel title="Ambulante Pflegenachweise" subtitle="Eigene Leistungen prüfen und bereitgestellte Nachweise unterschreiben">
  {query.loading ? <LoadingState message="Pflegenachweise werden geladen…" /> : null}
  {query.error || query.refreshError || error ? <ErrorState message={error ?? query.refreshError ?? query.error ?? ''} onRetry={query.refresh} /> : null}
  <PremiumButton title="Pflegenachweise aktualisieren" variant="secondary" disabled={busy} onPress={() => void query.refresh()} />
  {!query.loading && !query.error && !query.data?.length ? <Text style={{ color: c.muted }}>Noch keine bereitgestellten Pflegenachweise.</Text> : null}
  {query.data?.map((p) => <View key={p.id} style={{ gap: 8, paddingVertical: 16 }}>
   <Text style={{ color: c.text, fontWeight: '700' }}>{formatDate(p.date)} · {p.service}</Text>
   <Text style={{ color: c.muted }}>{formatTime(p.startedAt)}–{formatTime(p.endedAt)} · {p.employee}</Text>
   <Text style={{ color: c.text }}>{p.note}</Text><Text style={{ color: c.text }}>{(p.amountCents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })} · {labels[p.status] ?? p.status}</Text>
   {p.signer ? <Text style={{ color: c.muted }}>Unterschrieben von {p.signer}{p.signedAt ? ` am ${formatDate(p.signedAt)} um ${formatTime(p.signedAt)}` : ''}</Text> : null}
   {['signed','approved','rejected'].includes(p.status) ? <PremiumButton title="Gespeicherte Unterschrift anzeigen" variant="secondary" onPress={() => setSignatureId(p.id)} /> : null}
   {signatureId === p.id && signature.error ? <ErrorState message="Die gespeicherte Unterschrift konnte nicht geladen werden." onRetry={signature.refresh} /> : null}
   {signatureId === p.id && signature.loading ? <LoadingState message="Unterschrift wird geladen…" /> : null}
   {signatureId === p.id && signature.data ? <Image accessibilityLabel="Gespeicherte eigene Unterschrift" source={{ uri: signature.data.pngDataUrl }} resizeMode="contain" style={{ width: '100%', height: 110, backgroundColor: '#fff', borderRadius: 12 }} /> : null}
   {p.rejectionReason ? <Text style={{ color: c.text }}>Prüfrückmeldung: {p.rejectionReason}</Text> : null}
   <PremiumButton title="Pflegenachweis als PDF herunterladen" variant="secondary" disabled={busy} onPress={() => { if (lock.current) return; lock.current = true; setBusy(true); setError(null); void downloadMyCareProof(p.id).then((r) => { if (!r.ok) setError(r.error === 'PORTAL_CARE_NOT_ELIGIBLE' ? 'Dieser Nachweis ist nicht mehr verfügbar.' : r.error); }).catch(() => setError('PDF konnte nicht erstellt werden.')).finally(() => { lock.current = false; setBusy(false); }); }} />
   {p.status === 'submitted' ? <PremiumButton title="Leistung prüfen und unterschreiben" disabled={busy} onPress={() => { setSelected(p); setError(null); }} /> : null}
   {selected?.id === p.id ? <View style={{ gap: 8 }}><Text style={{ color: c.text }}>Mit Ihrer Unterschrift bestätigen Sie die aufgeführte Leistung vom {formatDate(selected.date)}. Prüfen Sie Zeiten und Dokumentation vor der Bestätigung.</Text><PremiumInput label="Ihr vollständiger Name" value={name} onChangeText={setName} editable={!busy} /><PremiumButton title="Unterschrift erfassen" disabled={busy || !name.trim()} onPress={() => setOpen(true)} /><PremiumButton title="Abbrechen" variant="secondary" disabled={busy} onPress={() => setSelected(null)} /></View> : null}
  </View>)}

  <CareSignatureModal visible={open} label="Eigenen Pflegenachweis unterschreiben" forceFullscreen disabled={busy} statusMessage={error} dismissScope={selected?.id} onClose={() => { if (!busy) setOpen(false); }} onConfirm={(png) => { void confirm(png).catch((err: unknown) => setError(err instanceof Error ? err.message : 'Unterschrift konnte nicht gespeichert werden.')); }} />
 </SectionPanel>;
}
export function EmployeeCareToursPanel() {
 const actor = usePortalActor();
 return actor.roleKey === 'employee_portal' && actor.isLinkedReady ? <EmployeeCareToursContent actor={actor} key={`${actor.tenantId}:${actor.employeeId}:${actor.actorId}`} /> : null;
}
function EmployeeCareToursContent({ actor }: { actor: PortalActor }) {
 const { c } = useCareLightPalette(); const [day, setDay] = useState(berlinCalendarDate()); const [dayInput, setDayInput] = useState(day);
 const [notes, setNotes] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false); const [actionError, setActionError] = useState<string | null>(null); const lock = useRef(false);
 const query = useAsyncQuery(() => fetchMyCareTours(day), [day], { queryKey: `${actor.tenantId}:${actor.employeeId}:${actor.actorId}:${day}:my-care-tours` });
 async function execute(id: string, status: string, previous: string, stop = false) {
  if (lock.current) return; lock.current = true; setBusy(true); setActionError(null);
  try { const r = stop ? await advanceMyCareStop(id, status, previous, notes[id] ?? '') : await advanceMyCareTour(id, status, previous);
   if (!r.ok) { setActionError(r.error === 'PORTAL_CARE_NOT_ELIGIBLE' ? 'Keine Berechtigung mehr für diese Tour. Bitte aktualisieren.' : r.error); return; }
   await query.refresh();
  } catch { setActionError('Verbindung unterbrochen. Bitte aktualisieren.'); } finally { lock.current = false; setBusy(false); }
 }
 if (query.error === 'PORTAL_CARE_NOT_ELIGIBLE') return null;
 return <SectionPanel title="Meine Pflegetouren" subtitle="Persönlich zugewiesene, freigegebene Touren">
  <PremiumInput label="Tag (JJJJ-MM-TT)" value={dayInput} onChangeText={setDayInput} editable={!busy} /><PremiumButton title="Tag anzeigen" variant="secondary" disabled={busy || !isCalendarDate(dayInput)} onPress={() => setDay(dayInput)} />
  {query.loading ? <LoadingState message="Eigene Touren werden geladen…" /> : null}
  {query.error || query.refreshError ? <ErrorState message={query.refreshError ?? query.error ?? ''} onRetry={query.refresh} /> : null}
  {actionError ? <ErrorState message={actionError} /> : null}
  <PremiumButton disabled={busy} title="Touren aktualisieren" variant="secondary" onPress={() => void query.refresh()} />
  {!query.loading && !query.error && !query.data?.length ? <Text style={{ color: c.muted }}>Für diesen Tag ist keine Pflegetour freigegeben.</Text> : null}
  {query.data?.map((tr) => <View key={tr.id} style={{ gap: 8, paddingVertical: 16 }}><Text style={{ color: c.text, fontWeight: '700' }}>{tr.name} · {labels[tr.status] ?? tr.status}</Text>{tr.vehicle ? <Text style={{ color: c.muted }}>{tr.vehicle}</Text> : null}{tr.stops.map((s) => <View key={s.id} style={{ gap: 4, paddingVertical: 8 }}><Text style={{ color: c.text, fontWeight: '600' }}>{s.start.slice(0,5)}–{s.end.slice(0,5)} · {s.client}</Text><Text style={{ color: c.muted }}>{s.address}</Text><Text style={{ color: c.text }}>{s.service} · {labels[s.status] ?? s.status}</Text>{s.note ? <Text style={{ color: c.muted }}>{s.note}</Text> : null}{tr.status === 'in_progress' && !['completed','cancelled'].includes(s.status) ? <View style={{ gap: 8 }}>{['arrived','in_progress'].includes(s.status) ? <PremiumInput label="Durchführungsbericht / Ausfallgrund" value={notes[s.id] ?? ''} onChangeText={(value) => setNotes((v) => ({ ...v, [s.id]: value }))} multiline editable={!busy} /> : null}<PremiumButton title={s.status === 'planned' ? 'Ankunft bestätigen' : s.status === 'arrived' ? 'Versorgung starten' : 'Dokumentieren und abschließen'} disabled={busy || (s.status === 'in_progress' && !notes[s.id]?.trim())} onPress={() => void execute(s.id, s.status === 'planned' ? 'arrived' : s.status === 'arrived' ? 'in_progress' : 'completed', s.status, true)} /><PremiumInput label="Begründung bei Ausfall" value={notes[s.id] ?? ''} onChangeText={(value) => setNotes((v) => ({ ...v, [s.id]: value }))} editable={!busy} /><PremiumButton title="Einsatz als ausgefallen dokumentieren" variant="secondary" disabled={busy || !notes[s.id]?.trim()} onPress={() => void execute(s.id, 'cancelled', s.status, true)} /></View> : null}</View>)}{tr.status === 'published' ? <PremiumButton title="Tour starten" disabled={busy || day !== berlinCalendarDate()} onPress={() => void execute(tr.id, 'in_progress', tr.status)} /> : tr.status === 'in_progress' ? <PremiumButton title="Tour abschließen" disabled={busy || !tr.stops.length || tr.stops.some((v) => !['completed','cancelled'].includes(v.status))} onPress={() => void execute(tr.id, 'completed', tr.status)} /> : null}</View>)}
  <Text style={{ color: c.muted }}>Ankunft, Versorgungsbeginn und Abschluss werden mit Serverzeit gespeichert. Ein Abschluss benötigt einen Durchführungsbericht; Ausfälle benötigen eine Begründung.</Text>
 </SectionPanel>;
}
