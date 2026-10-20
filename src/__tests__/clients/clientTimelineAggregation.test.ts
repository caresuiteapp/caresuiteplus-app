import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  aggregateClientTimelineEvents,
  buildTimelineEntrySubtitle,
  mapAuditRowToTimelineEvent,
  mapDocumentEventToTimelineEvent,
  sortTimelineEventsNewestFirst,
} from '@/lib/clients/clientTimelineAggregation';
import type { ClientTimelineEvent } from '@/types/modules/client';

const root = path.join(__dirname, '..', '..', '..');
const clientId = 'client-001';

function timelineEvent(overrides: Partial<ClientTimelineEvent> = {}): ClientTimelineEvent {
  return {
    id: 'tl-1',
    clientId,
    eventType: 'notiz',
    icon: '📝',
    title: 'Manuelle Notiz',
    subtitle: 'Test',
    timestamp: '2026-06-17T12:00:00.000Z',
    status: 'aktiv',
    actorName: 'Anna Krüger',
    isInternal: false,
    metadata: null,
    ...overrides,
  };
}

describe('clientTimelineAggregation', () => {
  it('mapAuditRowToTimelineEvent mappt Stammdaten-Änderungen', () => {
    const event = mapAuditRowToTimelineEvent(
      {
        id: 'audit-1',
        action: 'Stammdaten geändert',
        details: 'Telefon: +49 123',
        actor_name: 'Kevin Reinhardt',
        created_at: '2026-06-17T10:00:00.000Z',
        client_id: clientId,
      },
      clientId,
    );
    expect(event.title).toBe('Stammdaten geändert');
    expect(event.subtitle).toBe('Telefon: +49 123');
    expect(event.actorName).toBe('Kevin Reinhardt');
    expect(event.eventType).toBe('sonstige');
  });

  it('mapDocumentEventToTimelineEvent mappt Finalisierung auf Deutsch', () => {
    const event = mapDocumentEventToTimelineEvent(
      {
        id: 'doc-1',
        event_type: 'document_finalized',
        summary: 'Datenschutz: finalized',
        created_at: '2026-06-17T09:00:00.000Z',
        client_id: clientId,
        profiles: { first_name: 'Thomas', last_name: 'Keller', full_name: 'Thomas Keller' },
      },
      clientId,
    );
    expect(event.title).toBe('Dokument finalisiert');
    expect(event.eventType).toBe('dokument');
    expect(event.actorName).toBe('Thomas Keller');
  });

  it('aggregateClientTimelineEvents merged Audit, Dokumente und Notizen', () => {
    const merged = aggregateClientTimelineEvents({
      clientId,
      timelineEvents: [timelineEvent()],
      auditEntries: [
        {
          id: 'audit-1',
          action: 'Klient:in angelegt',
          details: 'Anlage über Assistent',
          actor_name: 'Kevin Reinhardt',
          created_at: '2026-06-01T08:00:00.000Z',
          client_id: clientId,
        },
      ],
      documentEvents: [
        {
          id: 'doc-1',
          event_type: 'document_finalized',
          summary: 'Vertrag finalisiert',
          created_at: '2026-06-10T08:00:00.000Z',
          client_id: clientId,
          profiles: { first_name: 'Kevin', last_name: 'Reinhardt', full_name: 'Kevin Reinhardt' },
        },
      ],
    });

    expect(merged).toHaveLength(3);
    expect(merged[0]?.id).toBe('tl-1');
    expect(merged[1]?.title).toBe('Dokument finalisiert');
    expect(merged[2]?.title).toBe('Klient:in angelegt');
  });

  it('aggregateClientTimelineEvents filtert interne Einträge im Portal-Modus', () => {
    const merged = aggregateClientTimelineEvents({
      clientId,
      portalOnly: true,
      timelineEvents: [
        timelineEvent({ id: 'public', isInternal: false }),
        timelineEvent({ id: 'internal', isInternal: true, title: 'Intern' }),
      ],
      auditEntries: [],
      documentEvents: [],
    });

    expect(merged.map((e) => e.id)).toEqual(['public']);
  });

  it('sortTimelineEventsNewestFirst sortiert absteigend nach Zeit', () => {
    const sorted = sortTimelineEventsNewestFirst([
      timelineEvent({ id: 'old', timestamp: '2026-06-01T08:00:00.000Z' }),
      timelineEvent({ id: 'new', timestamp: '2026-06-17T08:00:00.000Z' }),
    ]);
    expect(sorted[0]?.id).toBe('new');
  });

  it('buildTimelineEntrySubtitle enthält Typ, Akteur und Detail', () => {
    const subtitle = buildTimelineEntrySubtitle(
      mapAuditRowToTimelineEvent(
        {
          id: 'audit-2',
          action: 'Portal-Zugang eingerichtet',
          details: 'Benutzername: heinz.reinhardt',
          actor_name: 'Kevin Reinhardt',
          created_at: '2026-06-17T11:00:00.000Z',
          client_id: clientId,
        },
        clientId,
      ),
    );
    expect(subtitle).toContain('Portal');
    expect(subtitle).toContain('Kevin Reinhardt');
    expect(subtitle).toContain('heinz.reinhardt');
  });
});

describe('ClientRecord Verlauf tab UI', () => {
  it('rendert nur eine Verlauf-Section ohne VerlaufTab-Duplikat', () => {
    const source = readFileSync(
      path.join(root, 'src/screens/business/office/ClientRecordTabPanels.tsx'),
      'utf8',
    );
    expect(source).toContain('ClientRecordTimelinePanel');
    expect(source).not.toContain('VerlaufTab');
    expect(source).toContain('fetchClientTimeline');
    expect(source.match(/Verlauf \/ Timeline/g)?.length).toBe(1);
  });

  it('fetchTimeline im Repository nutzt Aggregation', () => {
    const source = readFileSync(
      path.join(root, 'src/lib/clients/repositories/clientExtendedRepository.supabase.ts'),
      'utf8',
    );
    expect(source).toContain('aggregateClientTimelineEvents');
    expect(source).toContain('client_audit_entries');
    expect(source).toContain('client_document_events');
  });
});
