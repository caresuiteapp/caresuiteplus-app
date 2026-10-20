import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Office Docs/Invoices/Appointments View-Toggle (Sprint 95)', () => {
  it('DocumentsListTable nutzt PremiumDataTable', () => {
    const source = readSrc('src/components/office/DocumentsListTable.tsx');
    expect(source).toContain('PremiumDataTable');
    expect(source).toContain('PORTAL_DOCUMENT_CATEGORY_LABELS');
  });

  it('InvoicesListTable nutzt PremiumDataTable mit Sortierung', () => {
    const source = readSrc('src/components/office/InvoicesListTable.tsx');
    expect(source).toContain('PremiumDataTable');
    expect(source).toContain('invoiceNumber');
    expect(source).toContain('dueDate');
  });

  it('AppointmentsListTable nutzt PremiumDataTable', () => {
    const source = readSrc('src/components/office/AppointmentsListTable.tsx');
    expect(source).toContain('PremiumDataTable');
    expect(source).toContain('startsAt');
  });

  it('DocumentsListHero integriert DesktopListViewToggle', () => {
    const source = readSrc('src/components/office/DocumentsListHero.tsx');
    expect(source).toContain('DesktopListViewToggle');
    expect(source).toContain('showViewToggle');
  });

  it('DocumentsListView nutzt office.documents Persistenz', () => {
    const source = readSrc('src/components/office/DocumentsListView.tsx');
    expect(source).toContain("useDesktopListViewPreference('office.documents')");
    expect(source).toContain('DocumentsListTable');
    expect(source).toContain('useTableLayout = isDesktop && viewMode');
  });

  it('InvoicesListView nutzt office.invoices Persistenz', () => {
    const source = readSrc('src/components/office/InvoicesListView.tsx');
    expect(source).toContain("useDesktopListViewPreference('office.invoices')");
    expect(source).toContain('InvoicesListTable');
    expect(source).toContain('showViewToggle={isDesktop && !embedded}');
  });

  it('AppointmentsListView nutzt office.appointments Persistenz', () => {
    const source = readSrc('src/components/office/AppointmentsListView.tsx');
    expect(source).toContain("useDesktopListViewPreference('office.appointments')");
    expect(source).toContain('AppointmentsListTable');
    expect(source).toContain('showViewToggle={isDesktop && !embedded}');
  });
});
