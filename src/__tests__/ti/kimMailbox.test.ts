import { describe, expect, it } from 'vitest';
import { queryKIMMailbox } from '@/data/demo/ti/kimQuery';
import { getKIMMessages, toKIMMessageListItem } from '@/data/demo/ti';
import { fetchKIMMailbox } from '@/lib/ti/kimMailboxService';
import { TI_DEMO_TENANT } from '@/data/demo/ti';
import { enforcePermission } from '@/lib/permissions';

describe('KIM Mailbox', () => {
  const allItems = getKIMMessages().map(toKIMMessageListItem);

  it('enforcePermission schützt KIM-Postfach', () => {
    expect(enforcePermission(null, 'ti.kim.view')).not.toBeNull();
  });

  it('queryKIMMailbox filtert Ungelesen', () => {
    const result = queryKIMMailbox(allItems, { status: 'unread', page: 1, pageSize: 10 });
    expect(result.filteredCount).toBe(2);
    expect(result.items.every((m) => m.status === 'unread')).toBe(true);
  });

  it('queryKIMMailbox durchsucht Betreff', () => {
    const result = queryKIMMailbox(allItems, { search: 'Entlassungsbericht', page: 1, pageSize: 10 });
    expect(result.filteredCount).toBe(1);
    expect(result.items[0]?.subject).toContain('Entlassungsbericht');
  });

  it('queryKIMMailbox sortiert neueste zuerst', () => {
    const result = queryKIMMailbox(allItems, { page: 1, pageSize: 10, sortDirection: 'desc' });
    const dates = result.items.map((m) => new Date(m.receivedAt).getTime());
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i - 1]).toBeGreaterThanOrEqual(dates[i]!);
    }
  });

  it('queryKIMMailbox paginiert korrekt', () => {
    const page1 = queryKIMMailbox(allItems, { page: 1, pageSize: 3 });
    const page2 = queryKIMMailbox(allItems, { page: 2, pageSize: 3 });
    expect(page1.items.length).toBe(3);
    expect(page1.hasMore).toBe(true);
    expect(page2.items.length).toBe(6);
    expect(page2.items.length).toBeGreaterThan(page1.items.length);
  });

  it('fetchKIMMailbox Service liefert Demo-Daten', async () => {
    const result = await fetchKIMMailbox(TI_DEMO_TENANT, { page: 1, pageSize: 10 }, 'business_admin');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.totalCount).toBeGreaterThan(0);
      expect(result.data.items.length).toBeGreaterThan(0);
    }
  });
});
