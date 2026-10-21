import { notifyCalendarWorkspaceChanged } from '@/lib/calendar/calendarWorkspaceRefresh.web';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { PlatformModal } from '@/components/layout/platform';
import { useAuth } from '@/lib/auth/context';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { confirmAction } from '@/lib/platform/confirmAction';
import { resolveCalendarFormWritePermission } from '@/lib/calendar/calendarEventSaveService';
import { archiveCustomCalendarEvent } from '@/lib/calendar/calendarWorkspaceMutations';
import { CALENDAR_EVENT_TYPE_LABELS, type CalendarEvent } from '@/types/modules/calendarEvent';
import type { CalendarModuleKey } from '@/types/calendar';
import { CalendarEventCreateModal } from './CalendarEventCreateModal.web';
import { CalendarDialogContent } from './CalendarDialogContent.web';

type Props = { visible: boolean; event: CalendarEvent | null; onClose: () => void; onUpdated?: () => void };
const MODULES: Record<string, string> = { office: 'Office', assist: 'Assist', pflege: 'Pflege', stationaer: 'Stationär', beratung: 'Beratung', akademie: 'Akademie' };
const STATUS: Record<string, string> = { active: 'Aktiv', aktiv: 'Aktiv', entwurf: 'Entwurf', approved: 'Genehmigt', pending: 'Zur Prüfung', requested: 'Beantragt', rejected: 'Abgelehnt', cancelled: 'Storniert', abgeschlossen: 'Abgeschlossen', in_bearbeitung: 'In Bearbeitung' };
const participant = (name?: string) => name?.trim() && !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(name) ? name.trim() : '';
export function formatCalendarEventPeriod(event: CalendarEvent) {
  const start = new Date(event.start), end = new Date(event.end);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return 'Zeitraum nicht verfügbar';
  const dateOptions = { timeZone: event.allDay ? 'UTC' : 'Europe/Berlin', day: '2-digit' as const, month: '2-digit' as const, year: 'numeric' as const };
  const first = start.toLocaleDateString('de-DE', dateOptions), last = end.toLocaleDateString('de-DE', dateOptions);
  if (event.allDay) return `${first}${first === last ? '' : ` – ${last}`} · ganztägig`;
  const time = (date: Date) => date.toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' });
  return `${first}, ${time(start)} – ${first === last ? '' : `${last}, `}${time(end)} Uhr`;
}
export function CalendarEventDrawer({ visible, event, onClose, onUpdated }: Props) {
  const router = useRouter(); const { profile } = useAuth(); const tenantId = useServiceTenantId(); const { can, isReadOnly } = usePermissions();
  const [editOpen, setEditOpen] = useState(false), [removing, setRemoving] = useState(false), [error, setError] = useState('');
  const busy = useRef(false); const alive = useRef(true);
  const scope = `${tenantId}:${profile?.id}:${event?.id}:${visible}`; const scopeRef = useRef(scope); scopeRef.current = scope;
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { setEditOpen(false); setRemoving(false); setError(''); busy.current = false; }, [scope]);
  if (!event || !visible) return null;
  const record = event.record, sourceType = event.sourceType ?? record?.sourceType;
  const moduleKey = (event.moduleKey ?? record?.moduleKey ?? 'office') as CalendarModuleKey;
  const permission = resolveCalendarFormWritePermission({ moduleKey, sourceContext: sourceType === 'appointment' ? 'appointment_management' : 'calendar', sourceType: record?.sourceType ?? 'custom_event' });
  const ownRecord = !!tenantId && !!record && record.tenantId === tenantId;
  const canEdit = ownRecord && !isReadOnly && !!record.sourceId && ['custom_event', 'appointment', 'intake_appointment'].includes(sourceType ?? '') && !!permission && can(permission);
  const canRemove = canEdit && ['custom_event', 'intake_appointment'].includes(sourceType ?? '');
  const linked = !!event.href;
  const remove = async () => {
    if (!canRemove || busy.current || !record || !tenantId) return;
    const submitted = scope; busy.current = true;
    const confirmed = await confirmAction({ title: 'Termin entfernen', message: `„${event.title}“ aus dem Kalender entfernen? Der Eintrag wird archiviert.`, confirmLabel: 'Entfernen', cancelLabel: 'Behalten' });
    if (!alive.current || scopeRef.current !== submitted) return;
    if (!confirmed) { busy.current = false; return; }
    setRemoving(true); setError('');
    try {
      const result = sourceType === 'intake_appointment'
        ? await archiveCustomCalendarEvent(tenantId, record.id, profile?.roleKey, 'intake_appointment')
        : await archiveCustomCalendarEvent(tenantId, record.id, profile?.roleKey);
      if (!alive.current || scopeRef.current !== submitted) return;
      if (!result.ok) { setError(result.error); return; }
      notifyCalendarWorkspaceChanged(tenantId);
      onUpdated?.(); onClose();
    } catch (cause) { if (alive.current && scopeRef.current === submitted) setError(cause instanceof Error ? cause.message : 'Termin konnte nicht entfernt werden.'); }
    finally { if (alive.current && scopeRef.current === submitted) { busy.current = false; setRemoving(false); } }
  };
  const client = participant(event.clientName), employee = participant(event.employeeName);
  const details = [['Zeitraum', formatCalendarEventPeriod(event)], ['Bereich', MODULES[moduleKey] ?? 'Kalender'], ['Status', event.status ? STATUS[event.status] ?? event.status : ''], ['Klient:in', client], ['Mitarbeitende', employee], ['Leistung', event.serviceTitle], ['Ort', record?.locationName], ['Raum', record?.room], ['Adresse', record?.address]];
  const visibleIn = record ? [record.isOfficeVisible && 'Zentraler Kalender', record.isModuleVisible && 'Kalender des Bereichs', record.isClientPortalVisible && 'Klientenportal', record.isEmployeePortalVisible && 'Mitarbeiterportal'].filter(Boolean) : [];
  return <>
    <PlatformModal visible={!editOpen} title="Termindetails" subtitle={CALENDAR_EVENT_TYPE_LABELS[event.type] ?? 'Kalenderereignis'} onClose={() => { if (!busy.current) onClose(); }} dismissOnBackdrop={!removing} surfaceScope="company" maxWidth={760} glowColor="#2786E7"
      footerActions={[
        ...(canEdit ? [{ title: 'Bearbeiten', disabled: removing, onPress: () => setEditOpen(true) }] : []),
        ...(linked ? [{ title: sourceType === 'intake_appointment' ? 'Klientenaufnahme öffnen' : ['absence', 'vacation', 'sick_leave'].includes(sourceType ?? '') ? 'Mitarbeiterakte öffnen' : sourceType === 'assist_visit' ? 'Einsatz öffnen' : 'Datensatz öffnen', disabled: removing, onPress: () => { onClose(); router.push(event.href as never); } }] : []),
        { title: 'Schließen', variant: 'secondary', disabled: removing, onPress: onClose },
      ]}>
      <CalendarDialogContent><div className="cd-stack">
        <div className="cd-panel cd-stack"><h2>{event.title}</h2><dl className="cd-details">{details.filter(([,value]) => !!value).map(([label,value]) => <div key={label} style={{ display: 'contents' }}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></div>
        {record?.description || record?.internalNote || record?.publicNote ? <section className="cd-panel cd-stack"><h3>Beschreibung und Hinweise</h3><dl className="cd-details">{[['Beschreibung', record.description], ['Interne Notiz', record.internalNote], ['Hinweis für die Portale', record.publicNote]].filter(([,value]) => !!value).map(([label,value]) => <div key={label} style={{ display: 'contents' }}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section> : null}
        {record ? <section className="cd-panel cd-stack"><h3>Sichtbarkeit</h3><p className="cd-muted">{visibleIn.join(' · ') || 'In den Kalenderansichten ausgeblendet.'}</p></section> : null}
        {event.isAtRisk || event.isIncomplete ? <p className="cd-info">{event.isAtRisk ? 'Dieser Einsatz benötigt eine Prüfung der Planung. ' : ''}{event.isIncomplete ? 'Dokumentation oder Nachweis sind noch offen.' : ''}</p> : null}
        {linked && !canEdit ? <p className="cd-footer-note">Änderungen erfolgen im zugehörigen Datensatz und werden in den Kalender übernommen.</p> : null}
        {error ? <p role="alert" className="cd-alert">{error}</p> : null}
        {canRemove ? <div><button type="button" className="cd-link cd-danger" disabled={removing} onClick={() => void remove()}>{removing ? 'Wird entfernt…' : 'Termin entfernen'}</button></div> : null}
      </div></CalendarDialogContent>
    </PlatformModal>
    <CalendarEventCreateModal visible={editOpen} sourceContext={sourceType === 'appointment' ? 'appointment_management' : 'calendar'} calendarScope={moduleKey === 'office' ? 'office' : 'module'} moduleKey={moduleKey} editEvent={event} onClose={() => setEditOpen(false)} onCreated={() => { setEditOpen(false); onUpdated?.(); onClose(); }} />
  </>;
}
