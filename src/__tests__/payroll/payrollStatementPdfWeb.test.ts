import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TextOptionsLight } from 'jspdf';
import { calculatePayrollSnapshot } from '@/lib/payroll/payrollCalculator.web';
import { payrollClaim } from './payrollWorkspaceFixtures';

const trace = vi.hoisted(() => ({ text: [] as { text: string; page: number; x: number; y: number; width: number }[] }));
vi.mock('jspdf/dist/jspdf.es.min.js', async importOriginal => {
  const original = await importOriginal<typeof import('jspdf')>();
  return { ...original, jsPDF: function (...args: ConstructorParameters<typeof original.jsPDF>) {
    const pdf = new original.jsPDF(...args);
    const write = pdf.text.bind(pdf);
    pdf.text = ((value: string | string[], x: number, y: number, options?: TextOptionsLight) => {
      const leading = pdf.getFontSize() * (options?.lineHeightFactor ?? pdf.getLineHeightFactor()) / pdf.internal.scaleFactor;
      (Array.isArray(value) ? value : [value]).forEach((line, index) => {
        const width = pdf.getTextWidth(line);
        trace.text.push({ text: line, page: pdf.getCurrentPageInfo().pageNumber,
          x: x - (options?.align === 'right' ? width : options?.align === 'center' ? width / 2 : 0), y: y + leading * index, width });
      });
      return write(value, x, y, options);
    }) as typeof pdf.text;
    return pdf;
  } };
});
import { renderPayrollStatementPdf } from '@/lib/payroll/payrollStatementPdf.web';

const base = () => calculatePayrollSnapshot({ employeeId: 'employee-a', employeeName: 'Testperson', employeeNumber: null,
  periodYear: 2026, periodMonth: 10, compensationType: 'hourly', compensationAmount: 15,
  actualWorkMinutes: 2836, travelMinutes: 0, vacationMinutes: 0, sickMinutes: 0, otherPaidAbsenceMinutes: 0,
  targetWorkMinutes: 2412, targetWorkSource: 'payout_limit', maxPayoutHours: 40.2, overflowToTimeAccount: true,
  plannedMinutes: 0, expenses: [], now: '2026-11-04T08:04:00Z' });
beforeEach(() => { trace.text = []; });

describe('monthly payroll PDF typesetting', () => {
  it('renders the checked amounts as vector text with an embedded font and leaves the snapshot unchanged', () => {
    const snapshot = base();
    const before = structuredClone(snapshot);
    const result = renderPayrollStatementPdf(snapshot, 1);
    const content = Buffer.from(result.bytes).toString('latin1');
    expect(content.startsWith('%PDF-')).toBe(true);
    expect(content).toContain('/FontFile2');
    expect(content).not.toContain('/Subtype /Image');
    expect(trace.text.map(item => item.text.replace(/\u00a0/g, ' '))).toEqual(expect.arrayContaining(['603,00 €', '40:12 Std.', '7:04 Std.', '0:00 Std.']));
    expect(snapshot).toEqual(before);
    expect(trace.text.every(item => item.x >= 15.8 && item.x + item.width <= 194.2 && item.y >= 10 && item.y <= 290)).toBe(true);
  });
  it('continues very long text and still renders the final expense and final next-month assignment', () => {
    const snapshot = base();
    snapshot.employeeName = 'Langer Personalname '.repeat(28);
    snapshot.expenseClaims = [payrollClaim('long-claim', { description: 'Vollständiger Belegtext '.repeat(250) + 'Beschreibungsschluss',
      businessPurpose: 'Vollständiger Zweck '.repeat(180) + 'Zweckschluss' }), payrollClaim('last-claim', { description: 'LetzterBeleg', businessPurpose: '' })];
    snapshot.nextMonthPreview = { periodYear: 2026, periodMonth: 11, totalPlannedMinutes: 120, assignments: [{
      assignmentId: 'last-next', workDate: '2026-11-30', clientLabel: 'LetztePerson', assignmentTitle: 'LetzterEinsatz',
      plannedStartAt: '2026-11-30T08:00:00Z', plannedEndAt: '2026-11-30T10:00:00Z', plannedMinutes: 120,
      actualStartAt: null, actualEndAt: null, actualMinutes: 0, travelMinutes: 0, differenceMinutes: -120, status: 'confirmed',
    }] };
    snapshot.assignmentTimeLines = [{ ...snapshot.nextMonthPreview.assignments[0], workDate: '2026-10-30', travelMinutes: 15 }];
    const result = renderPayrollStatementPdf(snapshot, 2);
    expect(result.pageCount).toBeGreaterThan(4);
    const all = trace.text.map(item => item.text).join('\n');
    for (const tail of ['Beschreibungsschluss', 'Zweckschluss', 'LetzterBeleg', 'LetzterEinsatz']) expect(all).toContain(tail);
    expect(all).not.toContain('− 2:00 Std.');
    expect(all).toContain('Fahrt');
    expect(trace.text.every(item => item.x >= 15.8 && item.x + item.width <= 194.2 && item.y <= 290)).toBe(true);
    expect(trace.text.some(item => item.page === result.pageCount && item.text === 'LetzterEinsatz')).toBe(true);
  });
  it('rejects an invalid edition or missing snapshot date before producing a PDF', () => {
    expect(() => renderPayrollStatementPdf(base(), 0)).toThrow('Abrechnungsversion');
    expect(() => renderPayrollStatementPdf({ ...base(), generatedAt: '' }, 1)).toThrow('Erstellungszeitpunkt');
  });
});
