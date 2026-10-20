import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  mapClientAuditRow,
  mapClientDocumentEventRow,
  mapCostCarrierAuditRow,
  mergeOfficeAuditEntries,
} from '@/lib/officeCore/auditLogMapper';
import { fetchOfficeAuditLog } from '@/lib/officeCore/auditLogService';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { enforcePermission } from '@/lib/permissions';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Office Audit-Log', () => {
  it('enforcePermission schützt Audit-Log-Service', () => {
    expect(enforcePermission(null, 'office.access' as never)).not.toBeNull();
  });

  it('fetchOfficeAuditLog liefert Demo-Einträge', async () => {
    const result = await fetchOfficeAuditLog(DEMO_TENANT_ID, 'business_admin');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data[0]?.action).toBeTruthy();
    }
  });

  it('mapClientAuditRow mappt Klienten-Audit', () => {
    const entry = mapClientAuditRow({
      id: 'audit-1',
      action: 'Status geändert',
      details: 'aktiv → in Bearbeitung',
      actor_name: 'Anna Krüger',
      created_at: '2026-06-17T10:00:00.000Z',
      client_id: 'client-001',
    });
    expect(entry.category).toBe('Klient');
    expect(entry.actor).toBe('Anna Krüger');
    expect(entry.detail).toContain('aktiv');
  });

  it('mapCostCarrierAuditRow mappt Kostenträger-Audit', () => {
    const entry = mapCostCarrierAuditRow({
      id: 'cc-1',
      tenant_id: 'tenant-1',
      action: 'updated',
      entity_type: 'cost_carrier',
      entity_id: 'carrier-001',
      actor_user_id: null,
      metadata: { actor_name: 'System' },
      created_at: '2026-06-17T09:00:00.000Z',
      new_value_hash: null,
      old_value_hash: null,
    });
    expect(entry.category).toBe('Kostenträger');
    expect(entry.detail).toContain('cost_carrier');
  });

  it('mapClientDocumentEventRow mappt Dokument-Ereignisse', () => {
    const entry = mapClientDocumentEventRow({
      id: 'doc-1',
      event_type: 'document_finalized',
      summary: 'Datenschutz-Einwilligung: finalized',
      created_at: '2026-06-17T08:00:00.000Z',
      client_id: 'client-001',
      profiles: { display_name: 'Thomas Keller' },
    });
    expect(entry.category).toBe('Dokument');
    expect(entry.action).toBe('document finalized');
    expect(entry.actor).toBe('Thomas Keller');
  });

  it('mergeOfficeAuditEntries sortiert nach Zeit absteigend', () => {
    const merged = mergeOfficeAuditEntries([
      {
        id: 'a',
        action: 'alt',
        detail: '',
        actor: 'System',
        category: 'Klient',
        icon: '👥',
        timestamp: '2026-06-01T08:00:00.000Z',
      },
      {
        id: 'b',
        action: 'neu',
        detail: '',
        actor: 'System',
        category: 'Dokument',
        icon: '📄',
        timestamp: '2026-06-17T08:00:00.000Z',
      },
    ]);
    expect(merged[0]?.id).toBe('b');
  });

  it('auditLogService nutzt Supabase-Repository im Live-Pfad', () => {
    const source = readSrc('src/lib/officeCore/auditLogService.ts');
    expect(source).toContain('getServiceMode');
    expect(source).toContain('officeAuditLogSupabaseRepository');
    expect(source).not.toContain('Office-Audit-Log im Live-Modus noch nicht vollständig angebunden');
    expect(source).not.toContain('guardLiveDemoFeature');
  });

  it('OfficeAuditLogScreen zeigt leeren Zustand', () => {
    const source = readSrc('src/screens/business/office/OfficeAuditLogScreen.tsx');
    expect(source).toContain('Keine Einträge');
  });
});
