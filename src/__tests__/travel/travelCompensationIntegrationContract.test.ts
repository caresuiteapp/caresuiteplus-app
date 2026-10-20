import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('Fahrtkosten-Integration', () => {
  it('verdrahtet Katalog, Mitarbeitendenregel, Fahrtenbuch und Gehaltsstatistik', () => {
    expect(read('src/components/tenant/TenantServiceCatalogModal.tsx')).toContain('TravelPolicyEditor');
    expect(read('src/components/office/EmployeePayrollPersonnelPanel.tsx')).toContain('travelPolicyOverride');
    expect(read('src/components/assist/TripsListTable.tsx')).toContain('payrollEligible');
    expect(read('src/screens/office/PayrollMonthOverviewScreen.tsx')).toContain('automatisch aus Fahrtenbuch');
  });

  it('sichert automatische Kilometererstattung mit genau einem Fahrtenbuchbezug', () => {
    const migration = read('supabase/migrations/20260811110000_travel_compensation_policy_payroll.sql');
    expect(migration).toContain('UNIQUE INDEX IF NOT EXISTS idx_employee_expense_claims_driving_log');
    expect(migration).toContain('sync_driving_log_to_payroll_expense');
    expect(migration).toContain('ON CONFLICT (tenant_id, driving_log_id)');
    expect(migration).toContain("'private_non_business'");
  });
});
