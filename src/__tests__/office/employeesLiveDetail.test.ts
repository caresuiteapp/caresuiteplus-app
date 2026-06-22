import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { mapEmployeeRowToDetail } from '@/lib/office/employeeDetailMapper';
import type { EmployeeDetailLiveRow } from '@/lib/office/employeeDetailMapper';
import { isEmployeeDetailLiveReady } from '@/lib/office/employeeModuleConfig';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('employees live detail mapping (Sprint 72)', () => {
  const completeRow: EmployeeDetailLiveRow = {
    id: 'employee-001',
    tenant_id: DEMO_TENANT_ID,
    first_name: 'Anna',
    last_name: 'Schmidt',
    job_title: 'Pflegefachkraft',
    email: 'anna@example.com',
    phone: '+49 123',
    status: 'aktiv',
    department: 'Ambulant',
    start_date: '2024-03-01',
    notes: 'Schichtleitung Mo–Mi.',
    created_at: '2024-03-01T00:00:00.000Z',
    updated_at: '2026-06-12T00:00:00.000Z',
  };

  it('Migration 0033 fügt Detail-Felder mit IF NOT EXISTS hinzu', () => {
    const sql = readSrc('supabase/migrations/0033_employees_live_detail_fields.sql');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS department');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS start_date');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS notes');
    expect(sql).not.toMatch(/^\s*DROP\b/im);
    expect(sql).not.toMatch(/^\s*TRUNCATE\b/im);
  });

  it('mapEmployeeRowToDetail mappt vollständige Zeile', () => {
    const result = mapEmployeeRowToDetail(completeRow);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.department).toBe('Ambulant');
      expect(result.data.startDate).toBe('2024-03-01');
      expect(result.data.notes).toBe('Schichtleitung Mo–Mi.');
    }
  });

  it('mapEmployeeRowToDetail meldet fehlendes Schema ehrlich', () => {
    const incomplete: EmployeeDetailLiveRow = {
      ...completeRow,
      notes: undefined,
    };
    const result = mapEmployeeRowToDetail(incomplete);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Schema unvollständig');
      expect(result.error).toContain('notes');
      expect(result.error).toContain('0033');
    }
  });

  it('employeeRepository nutzt EMPLOYEE_DETAIL_SELECT_COLUMNS und getDetailMapped', () => {
    const source = readSrc('src/lib/services/repositories/employeeRepository.supabase.ts');
    expect(source).toContain('EMPLOYEE_DETAIL_SELECT_COLUMNS');
    expect(source).toContain('getDetailMapped');
    expect(source).toContain('mapEmployeeRowToDetail');
  });

  it('fetchEmployeeDetail nutzt Supabase-Repo ohne Demo-Fallback in Live-Pfad', () => {
    const source = readSrc('src/lib/office/employeeDetailService.ts');
    expect(source).toContain('getDetailMapped');
    expect(source).toMatch(
      /fetchEmployeeDetail[\s\S]*getServiceMode\(\) === 'supabase'[\s\S]*getDetailMapped/,
    );
    expect(source).not.toContain('service_role');
  });

  it('isEmployeeDetailLiveReady ist im Demo-Testlauf false', () => {
    expect(isEmployeeDetailLiveReady()).toBe(false);
  });
});
