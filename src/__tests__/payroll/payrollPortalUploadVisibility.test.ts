import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { mapPayrollPortalUpload } from '@/lib/payroll/payrollMonthService';

describe('Payroll portal upload visibility', () => {
  it('maps pending employee uploads to the correct payroll employee', () => {
    expect(mapPayrollPortalUpload({
      id: 'upload-1',
      employee_id: 'employee-1',
      file_name: 'DE-Ticket Mhi Aldeen Aljlelati.pdf',
      storage_path: 'tenant/tenant-1/employees/employee-1/portal-uploads/upload-1/ticket.pdf',
      category: 'sonstiges',
      status: 'hochgeladen',
      created_at: '2026-07-24T19:00:00.000Z',
    })).toEqual({
      id: 'upload-1',
      employeeId: 'employee-1',
      fileName: 'DE-Ticket Mhi Aldeen Aljlelati.pdf',
      storagePath: 'tenant/tenant-1/employees/employee-1/portal-uploads/upload-1/ticket.pdf',
      category: 'sonstiges',
      status: 'hochgeladen',
      createdAt: '2026-07-24T19:00:00.000Z',
    });
  });

  it('loads employee portal uploads without a fragile embedded employee relation', () => {
    const service = readFileSync('src/lib/portal/assist/portalDocumentUploadService.ts', 'utf8');
    expect(service).toContain(".select('*')");
    expect(service).not.toContain(".select('*, employees(first_name, last_name)')");
  });

  it('shows pending portal documents directly on the Office payroll employee card', () => {
    const screen = readFileSync('src/screens/office/PayrollMonthOverviewScreen.tsx', 'utf8');
    expect(screen).toContain('Neu eingereichte Portal-Dokumente');
    expect(screen).toContain('employee.pendingPortalUploads.map');
    expect(screen).toContain('openPdf(upload.storagePath)');
  });
});
