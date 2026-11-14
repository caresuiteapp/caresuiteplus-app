import { describe, expect, it } from 'vitest';
import { blankCareDocumentationEntry, type CareDocumentationOriginal } from '@/lib/pflege/careDocumentationPacket.web';
import { careDocumentationDateRangeIssue, careDocumentationQueueState, filterCareDocumentationQueue, matchesCareDocumentationName } from '@/lib/pflege/careDocumentationQueue.web';

const fingerprint = 'sha256:' + '0'.repeat(64);
function row(title: string, occurredAt: string, override: Partial<CareDocumentationOriginal> = {}): CareDocumentationOriginal {
  return {
    id: title, tenantId: 'synthetic-tenant', clientId: 'synthetic-client', rootId: title, headId: title,
    revision: 1, kind: 'care_report', recordedAt: occurredAt, occurredAt, createdAt: occurredAt,
    recordedBy: 'synthetic-actor', recordedByName: 'Übungsfachkraft', contentFingerprint: fingerprint, history: [],
    signature: null, voided: false, payload: { ...blankCareDocumentationEntry('care_report', occurredAt), title,
      observation: 'Beobachtung im Übungsfall', intervention: 'Keine Durchführung', result: 'Verlauf dokumentiert' }, ...override,
  };
}

const draft = row('Offener Eintrag', '2026-11-13T23:10:00Z');
const signature = { personId: 'test', personName: 'Testperson', role: 'Testrolle', scope: 'Aktuelle Fassung',
  basis: 'Synthetischer Beleg', confirmedAt: '2026-11-14T12:00:00Z', contentFingerprint: fingerprint };
const confirmed = row('Bestätigter Eintrag', '2026-11-14T21:55:00Z', { signature });
const voided = row('Ungültiger Eintrag', '2026-11-14T22:00:00Z', { signature, voided: true });
const nearMidnight = row('Folgetag', '2026-11-14T23:05:00Z');

describe('Fallbezogene Pflegedokumentation', () => {
  it('verwendet das Ereignisdatum in Berlin einschließlich beiden Grenztagen', () => {
    const original = [nearMidnight, voided, confirmed, draft];
    expect(filterCareDocumentationQueue(original, {
      mode: 'all', kind: 'all', term: '', range: { from: '2026-11-14', to: '2026-11-14' },
    })).toEqual([voided, confirmed, draft]);
    expect(original).toEqual([nearMidnight, voided, confirmed, draft]);
  });

  it('markiert nur zur genauen Fassung passende Bestätigungen, ungültige Fassungen gesondert', () => {
    expect(careDocumentationQueueState(confirmed)).toBe('confirmed');
    expect(careDocumentationQueueState(voided)).toBe('voided');
    expect(careDocumentationQueueState({ ...draft, signature: { ...signature, contentFingerprint: 'fremd' } })).toBe('unconfirmed');
    expect(filterCareDocumentationQueue([draft, confirmed, voided], {
      mode: 'unconfirmed', kind: 'care_report', term: 'ubungsfachkraft OFFEN', range: { from: '', to: '' },
    })).toEqual([draft]);
  });

  it('unterbindet ungültige Datumsfilter und verarbeitet mehrteilige Namen ohne Akzente', () => {
    const dateRange = { from: '2026-02-29', to: '2026-11-14' };
    expect(careDocumentationDateRangeIssue(dateRange)).toMatch(/gültiges Datum/);
    expect(careDocumentationDateRangeIssue({ from: '2026-11-15', to: '2026-11-14' })).toMatch(/nicht nach/);
    expect(filterCareDocumentationQueue([draft], { mode: 'all', kind: 'all', term: '', range: dateRange })).toEqual([]);
    expect(matchesCareDocumentationName('weis Anna', 'Anna-Louise', 'Weiß')).toBe(true);
    expect(matchesCareDocumentationName('Ben Weiss', 'Anna-Louise', 'Weiß')).toBe(false);
  });
});
