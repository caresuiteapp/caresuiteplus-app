// Generated native presentation from src/lib/payroll/payrollStatementPdf.web.ts. Update through scripts/port-native-workspaces.mjs.
import * as jsPdfModule from 'jspdf/dist/jspdf.es.min.js';
import { CARESUITE_PDF_FONT, createCareSuitePdfText, registerCareSuitePdfFont } from '@/lib/documents/centuryGothicPdf';
import { formatPayrollBalanceMinutes, formatPayrollMinutes, formatPayrollMoney, payrollExpenseTotals, type PayrollWebStatementSnapshot } from "./payrollCalculator.native.ts";
import type { PayrollAssignmentTimeLine } from '@/types/modules/payrollMonth';
const { jsPDF } = jsPdfModule as unknown as typeof import('jspdf');
const INK = '#19334E', BLUE = '#1464B9', MUTED = '#52677B', RULE = '#DAE4EE', LIGHT = '#F3F7FB';
const monthFormatter = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric', timeZone: 'Europe/Berlin' });
const dateTimeFormatter = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });
const timeFormatter = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });
const statusLabels: Record<string, string> = {
    planned: 'Geplant', confirmed: 'Bestätigt', assigned: 'Zugewiesen', in_progress: 'Läuft', started: 'Begonnen',
    completed: 'Abgeschlossen', finished: 'Beendet', ended: 'Beendet', documentation_open: 'Dokumentation offen',
    signature_open: 'Unterschrift offen', cancelled: 'Abgesagt', canceled: 'Abgesagt', no_show: 'Nicht erschienen',
    pending: 'Prüfung offen', open: 'Offen', approved: 'Freigegeben', partially_approved: 'Teilweise genehmigt',
    rejected: 'Abgelehnt', clarification: 'Rückfrage', corrected: 'Korrigiert', locked: 'Gesperrt', exported: 'Exportiert',
    submitted: 'Eingereicht', needs_info: 'Rückfrage offen', reimbursed: 'Bereits erstattet', draft: 'Entwurf',
    scheduled: 'Geplant', paid: 'Bezahlt', superseded: 'Ersetzt', changed_after_export: 'Nach Export geändert',
    beendet: 'Beendet', bestätigt: 'Bestätigt', geplant: 'Geplant', abgesagt: 'Abgesagt',
};
type Block = {
    text: string;
    bold?: boolean;
    muted?: boolean;
};
type Cell = {
    blocks: Block[];
    right?: boolean;
};
type Column = {
    label: string;
    width: number;
    right?: boolean;
};
const cell = (text: string, right = false): Cell => ({ blocks: [{ text }], right });
const date = (value: string) => /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10).split('-').reverse().join('.') : value;
const time = (value: string | null) => value && Number.isFinite(Date.parse(value)) ? timeFormatter.format(new Date(value)) : '—';
const month = (year: number, value: number) => monthFormatter.format(new Date(Date.UTC(year, value - 1, 1, 12)));
const status = (value: string | null) => statusLabels[value ?? ''] ?? value ?? 'Nicht angegeben';
/** Shared vector typesetting: real font metrics, searchable text and complete rows.
 * No screenshot scaling or guessed character counts are used for pagination. */
export function renderPayrollStatementPdf(snapshot: PayrollWebStatementSnapshot, version: number): {
    bytes: Uint8Array;
    pageCount: number;
} {
    if (!Number.isInteger(version) || version < 1)
        throw new Error('Die Abrechnungsversion ist ungültig.');
    const generated = new Date(snapshot.generatedAt);
    if (!Number.isFinite(generated.getTime()))
        throw new Error('Der Erstellungszeitpunkt fehlt.');
    const expenses = [...new Map(snapshot.expenseClaims.map(claim => [claim.id, claim])).values()];
    const totals = payrollExpenseTotals(snapshot.expenseClaims, snapshot);
    const period = month(snapshot.periodYear, snapshot.periodMonth);
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    registerCareSuitePdfFont(pdf);
    const text = createCareSuitePdfText(pdf);
    const margin = 16, width = 178, bottom = 277;
    let y = 0;
    let pageTitle = 'Gehaltsübersicht', pageSubtitle = `${period} · Version ${version}`;
    const font = (size = 9, bold = false, color = INK) => { pdf.setFont(CARESUITE_PDF_FONT, bold ? 'bold' : 'normal'); pdf.setFontSize(size); pdf.setTextColor(color); };
    const wrap = (value: string, available: number, size = 9, bold = false): string[] => {
        font(size, bold);
        return pdf.splitTextToSize(value.replace(/\r/g, '').replace(/\u00a0/g, ' '), available) as string[];
    };
    const header = () => {
        font(12, true, BLUE);
        text('CareSuite+', margin, 16);
        font(7.5, false, MUTED);
        text('PERSONAL · MONATSÜBERSICHT', margin + 30, 16);
        text(`Stand ${dateTimeFormatter.format(generated)}`, margin + width, 16, { align: 'right' });
        pdf.setDrawColor(RULE);
        pdf.setLineWidth(0.25);
        pdf.line(margin, 22, margin + width, 22);
        font(18, true);
        text(pageTitle, margin, 33);
        font(8.5, false, MUTED);
        text(pageSubtitle, margin, 40);
        y = 47;
    };
    const nextPage = () => { pdf.addPage(); header(); };
    const sectionPage = (title: string, subtitle = period) => { pageTitle = title; pageSubtitle = subtitle; nextPage(); };
    const room = (needed: number) => { if (y + needed > bottom)
        nextPage(); };
    const paragraph = (value: string, size = 8.5, color = MUTED, leading = 4, bold = false) => {
        for (const line of wrap(value, width, size, bold)) {
            room(leading);
            font(size, bold, color);
            text(line, margin, y);
            y += leading;
        }
        y += 2;
    };
    header();
    paragraph(snapshot.employeeName, 18, INK, 7, true);
    paragraph(snapshot.employeeNumber ? `Personalnummer: ${snapshot.employeeNumber}` : 'Personalnummer: Nicht hinterlegt');
    y += 2;
    const cardWidth = (width - 9) / 4;
    // Long identity text may use continuation pages; keep the summary together.
    room(175);
    const cards = [
        [snapshot.catchUpWorkMinutes ? 'Abrechnungsrelevante Zeit' : snapshot.currentPeriodWorkMinutes != null ? 'Freigegebene Arbeitszeit' : 'Arbeitszeit erfasst', formatPayrollMinutes(snapshot.actualWorkMinutes)],
        ['Vergütbare Zeit', formatPayrollMinutes(snapshot.payableMinutes)],
        [snapshot.compensationType === 'salary' ? 'Festgehalt des Monats' : 'Monatsbrutto', formatPayrollMoney(snapshot.earnedGrossCents)],
        ['Vorgesehener Übertrag', formatPayrollMinutes(snapshot.overtimeTransferMinutes)],
    ];
    cards.forEach(([label, value], index) => {
        const x = margin + index * (cardWidth + 3);
        pdf.setFillColor(LIGHT);
        pdf.roundedRect(x, y, cardWidth, 27, 2, 2, 'F');
        pdf.setFillColor(BLUE);
        pdf.rect(x, y, cardWidth, 0.8, 'F');
        const labels = wrap(label, cardWidth - 6, 8);
        font(8, false, MUTED);
        text(labels, x + 3, y + 6, { lineHeightFactor: 1.2 });
        let size = 16;
        font(size, true, BLUE);
        while (pdf.getTextWidth(value) > cardWidth - 6 && size > 10) {
            size -= 0.5;
            font(size, true, BLUE);
        }
        text(value, x + 3, y + 21);
    });
    y += 38;
    const columnWidth = 85, columnTop = y;
    const summary = (x: number, title: string, rows: {
        label: string;
        value: string;
        total?: boolean;
    }[]) => {
        font(11, true, BLUE);
        text(title, x, columnTop);
        let rowY = columnTop + 5;
        for (const item of rows) {
            const labels = wrap(item.label, columnWidth - 30, 8.5);
            const height = Math.max(8, labels.length * 4.1 + 3.2);
            if (rowY + height > bottom - 25)
                throw new Error('Die Zusammenfassung passt nicht auf eine Seite. Bitte die Personalangaben kürzen.');
            if (item.total) {
                pdf.setFillColor(LIGHT);
                pdf.roundedRect(x, rowY, columnWidth, height + 1, 1.5, 1.5, 'F');
            }
            font(8.5, item.total, item.total ? BLUE : MUTED);
            text(labels, x + (item.total ? 2 : 0), rowY + 4.8, { lineHeightFactor: 1.37 });
            font(9, true, item.total ? BLUE : INK);
            text(item.value, x + columnWidth - (item.total ? 2 : 0), rowY + 4.8, { align: 'right' });
            if (!item.total) {
                pdf.setDrawColor(RULE);
                pdf.setLineWidth(0.15);
                pdf.line(x, rowY + height, x + columnWidth, rowY + height);
            }
            rowY += height + (item.total ? 2 : 0);
        }
        return rowY;
    };
    const credited = snapshot.creditedActualMinutes ?? snapshot.actualWorkMinutes + snapshot.vacationMinutes + snapshot.sickMinutes + snapshot.otherPaidAbsenceMinutes;
    const target = snapshot.targetWorkMinutes;
    const leftBottom = summary(margin, 'Arbeitszeit und Zeitkonto', [
        ...(snapshot.catchUpWorkMinutes ? [
            { label: 'Freigegebene Zeit dieses Monats', value: formatPayrollMinutes(snapshot.currentPeriodWorkMinutes ?? 0) },
            { label: 'Nachberechnung aus Vormonaten', value: formatPayrollMinutes(snapshot.catchUpWorkMinutes) },
        ] : []),
        { label: 'Davon angerechnete Fahrzeit', value: formatPayrollMinutes(snapshot.travelMinutes) },
        { label: 'Angerechneter Urlaub', value: formatPayrollMinutes(snapshot.vacationMinutes) },
        { label: 'Angerechnete Krankheit', value: formatPayrollMinutes(snapshot.sickMinutes) },
        { label: 'Weitere bezahlte Abwesenheit', value: formatPayrollMinutes(snapshot.otherPaidAbsenceMinutes) },
        { label: 'Anrechenbares Ist', value: formatPayrollMinutes(credited) },
        { label: snapshot.targetWorkSource === 'payout_limit' ? 'Auszahlungsbasis des Monats' : 'Vertragliches Monatssoll', value: target == null ? 'Nicht hinterlegt' : formatPayrollMinutes(target) },
        { label: snapshot.targetWorkSource === 'payout_limit' ? 'Übertrag oberhalb der Auszahlungsbasis' : 'Soll-/Ist-Differenz', value: target == null ? '—' : formatPayrollBalanceMinutes(snapshot.targetActualDifferenceMinutes ?? credited - target) },
        { label: 'Auszahlungsgrenze', value: snapshot.maxPayoutMinutes == null ? 'Keine Begrenzung' : formatPayrollMinutes(snapshot.maxPayoutMinutes) },
        { label: 'Offener Einsatzplan', value: formatPayrollMinutes(snapshot.plannedMinutes) },
        { label: 'Geplante bezahlte Abwesenheit', value: formatPayrollMinutes(snapshot.projectedPaidAbsenceMinutes ?? 0) },
    ]);
    const rightBottom = summary(margin + columnWidth + 8, 'Vergütung und Auslagen', [
        ...(snapshot.compensationType === 'hourly' ? [{ label: 'Stundenlohn brutto', value: formatPayrollMoney(snapshot.hourlyRateCents) }] : []),
        { label: snapshot.compensationType === 'salary' ? 'Festgehalt des Monats' : 'Brutto aus erfasster Zeit und Abwesenheit', value: formatPayrollMoney(snapshot.earnedGrossCents) },
        { label: 'Voraussichtliches Monatsbrutto', value: formatPayrollMoney(snapshot.projectedGrossCents) },
        { label: 'Genehmigte Auslagen, noch offen', value: formatPayrollMoney(totals.approvedExpensesCents) },
        { label: 'Bereits erstattete Auslagen', value: formatPayrollMoney(totals.reimbursedExpensesCents) },
        { label: 'Auslagen zur Prüfung', value: formatPayrollMoney(totals.pendingExpensesCents) },
        { label: 'Vorschüsse', value: formatPayrollMoney(snapshot.advancesCents) },
        { label: 'Weitere Abzüge', value: formatPayrollMoney(snapshot.deductionsCents) },
        { label: 'Prognose vor Lohnabgaben', value: formatPayrollMoney(snapshot.projectedTotalPayoutCents), total: true },
    ]);
    y = Math.max(leftBottom, rightBottom) + 8;
    paragraph('Diese Übersicht zeigt Bruttowerte und Auslagen. Sie ersetzt keine Lohnabrechnung und weist keinen Nettoauszahlungsbetrag aus. Bereits erstattete Auslagen werden nicht erneut hinzugerechnet.', 8);
    paragraph('Geplante Zeiten und Vergütungen sind Prognosen. Nur nach der hinterlegten Regel anrechenbare Fahrzeit ist enthalten. Vorgesehene Überträge sind noch keine Zeitkontobuchung.', 8);
    const table = (title: string, subtitle: string, introduction: string, columns: Column[], rows: Cell[][], continuePage = false) => {
        if (continuePage) {
            room(42);
            y += 8;
            paragraph(title, 11, BLUE, 5, true);
            pageTitle = title;
            pageSubtitle = subtitle;
        }
        else
            sectionPage(title, subtitle);
        const leading = 3.6, padding = 1.5, size = 8.3;
        const offsets = columns.map((_, index) => columns.slice(0, index).reduce((sum, column) => sum + column.width, 0));
        const tableHeader = () => {
            const labels = columns.map(column => wrap(column.label, column.width - padding * 2, 7.5, true));
            const height = Math.max(...labels.map(lines => lines.length)) * leading + 3.5;
            pdf.setFillColor(BLUE);
            pdf.rect(margin, y, width, height, 'F');
            columns.forEach((column, index) => {
                font(7.5, true, '#FFFFFF');
                text(labels[index], margin + offsets[index] + (column.right ? column.width - padding : padding), y + 4.1, { align: column.right ? 'right' : 'left', lineHeightFactor: 1.43 });
            });
            y += height;
        };
        const tablePage = () => { nextPage(); tableHeader(); };
        paragraph(introduction, 8);
        if (!rows.length) {
            paragraph('Für diesen Bereich sind zum Erstellungszeitpunkt keine Einträge gespeichert.', 9);
            return;
        }
        tableHeader();
        const fullPageCapacity = bottom - y;
        rows.forEach((cells, rowIndex) => {
            const lines = cells.map((entry, index) => entry.blocks.flatMap(block => wrap(block.text || '—', columns[index].width - padding * 2, size, block.bold).map(value => ({ ...block, text: value }))));
            const count = Math.max(1, ...lines.map(items => items.length));
            const fullHeight = count * leading + padding * 2;
            if (fullHeight <= fullPageCapacity && y + fullHeight > bottom)
                tablePage();
            let offset = 0;
            while (offset < count) {
                if (bottom - y < leading + padding * 2)
                    tablePage();
                const take = Math.min(count - offset, Math.max(1, Math.floor((bottom - y - padding * 2) / leading)));
                const height = take * leading + padding * 2;
                if (rowIndex % 2 === 0) {
                    pdf.setFillColor(LIGHT);
                    pdf.rect(margin, y, width, height, 'F');
                }
                cells.forEach((entry, index) => {
                    const current = lines[index].slice(offset, offset + take);
                    current.forEach((line, lineIndex) => {
                        font(size, line.bold, line.muted ? MUTED : INK);
                        text(line.text, margin + offsets[index] + (entry.right ? columns[index].width - padding : padding), y + padding + 2.7 + lineIndex * leading, { align: entry.right ? 'right' : 'left' });
                    });
                    if (offset > 0 && index === 0 && !current.length) {
                        font(6.5, false, MUTED);
                        text('Fortsetzung', margin + padding, y + padding + 2.7);
                    }
                });
                pdf.setDrawColor(RULE);
                pdf.setLineWidth(0.15);
                pdf.line(margin, y + height, margin + width, y + height);
                y += height;
                offset += take;
                if (offset < count)
                    tablePage();
            }
        });
    };
    const assignmentCells = (line: PayrollAssignmentTimeLine, actual: boolean, travel: boolean): Cell[] => {
        const times = (start: string | null, end: string | null, minutes: number, present = true): Cell => present ? { blocks: [
                { text: `${time(start)}–${time(end)}` }, { text: formatPayrollMinutes(minutes), muted: true },
            ] } : cell('—');
        const actualPresent = Boolean(line.actualStartAt || line.actualEndAt || line.actualMinutes > 0);
        return [cell(date(line.workDate)), { blocks: [{ text: line.clientLabel ?? 'Ohne Klientenzuordnung', bold: true }, { text: line.assignmentTitle, muted: true }] },
            times(line.plannedStartAt, line.plannedEndAt, line.plannedMinutes),
            ...(actual ? [times(line.actualStartAt, line.actualEndAt, line.actualMinutes, actualPresent),
                ...(travel ? [cell(formatPayrollMinutes(line.travelMinutes), true)] : []),
                cell(actualPresent ? formatPayrollBalanceMinutes(line.differenceMinutes) : '—', true)] : []), cell(line.payrollDisposition === 'deferred' ? 'Zurückgestellt' : status(line.status))];
    };
    const current = snapshot.assignmentTimeLines ?? [];
    const hasTravel = current.some(line => line.travelMinutes > 0);
    table('Einsätze und Arbeitszeiten', `${period} · ${current.length} ${current.length === 1 ? 'Eintrag' : 'Einträge'}`, `Gespeicherter Plan und erfasste Zeiten. Ein Einsatzstatus bestätigt keine Arbeitszeitfreigabe. ${hasTravel ? 'Fahrzeit wird separat ausgewiesen.' : 'In diesen Zeilen ist keine Fahrzeit angerechnet.'} Eine fehlende Zeiterfassung ist keine Minuszeit.`, hasTravel ? [{ label: 'Datum', width: 19 }, { label: 'Klient:in / Einsatz', width: 50 }, { label: 'Plan', width: 25 }, { label: 'Erfasst', width: 25 }, { label: 'Fahrt', width: 16, right: true }, { label: 'Differenz', width: 20, right: true }, { label: 'Status', width: 23 }]
        : [{ label: 'Datum', width: 19 }, { label: 'Klient:in / Einsatz', width: 61 }, { label: 'Plan', width: 26 }, { label: 'Erfasst', width: 26 }, { label: 'Differenz', width: 21, right: true }, { label: 'Status', width: 25 }], current.map(line => assignmentCells(line, true, hasTravel)));
    if (snapshot.catchUpTimeEntries?.length)
        table('Nachberechnungen aus Vormonaten', `${period} · ${snapshot.catchUpTimeEntries.length} Einträge`, 'Die folgenden Zeiten wurden im Ursprungsmonat zurückgestellt und nach Korrektur und Freigabe in dieser Monatsübersicht berücksichtigt. Sie sind in der Arbeitszeit und der Auszahlungsgrenze dieses Monats enthalten.', [{ label: 'Arbeitstag', width: 24 }, { label: 'Klient:in / Einsatz', width: 91 }, { label: 'Erfasste Zeit', width: 35 }, { label: 'Nachberechnet', width: 28, right: true }], snapshot.catchUpTimeEntries.map(item => [cell(date(item.workDate)), { blocks: [{ text: item.clientLabel || item.assignmentTitle, bold: true }, ...(item.clientLabel ? [{ text: item.assignmentTitle, muted: true }] : [])] },
            cell(`${time(item.actualStartAt)}–${time(item.actualEndAt)}`), cell(formatPayrollMinutes(item.minutes), true)]), true);
    if (snapshot.deferredTimeEntries?.length)
        table('Zurückgestellte Zeiten', `${period} · ${snapshot.deferredTimeEntries.length} Einträge`, 'Diese Zeiten sind für diesen Monat übersprungen und nicht eingerechnet. Die Einträge bleiben zur Nachbearbeitung offen. Nach Korrektur und Freigabe können sie in einem Folgemonat nachberechnet werden.', [{ label: 'Arbeitstag', width: 24 }, { label: 'Klient:in / Einsatz', width: 94 }, { label: 'Grund der Zurückstellung', width: 60 }], snapshot.deferredTimeEntries.map(item => [cell(date(item.workDate)), { blocks: [{ text: item.clientLabel || item.assignmentTitle, bold: true }, ...(item.clientLabel ? [{ text: item.assignmentTitle, muted: true }] : [])] },
            cell(({ missing: 'Zeiterfassung fehlt', incomplete: 'Abschluss fehlt oder ist ungültig', unapproved: 'Freigabe fehlt', rejected: 'Korrektur erforderlich', deferred: 'Bereits zurückgestellt' })[item.reason] || 'Nachbearbeitung offen')]), true);
    if (expenses.length)
        table('Auslagen und Erstattungen', `${period} · ${expenses.length} Belege`, 'Eingereichte und genehmigte Beträge sind getrennt ausgewiesen. Der Status zeigt auch bereits erstattete Auslagen. Die steuerliche Behandlung ist anhand der Belege zu prüfen.', [{ label: 'Datum', width: 19 }, { label: 'Beschreibung / Zweck', width: 99 }, { label: 'Status', width: 22 }, { label: 'Eingereicht', width: 19, right: true }, { label: 'Genehmigt', width: 19, right: true }], expenses.map(claim => [cell(date(claim.expenseDate)), { blocks: [{ text: claim.description }, ...(claim.businessPurpose.trim() ? [{ text: `Zweck: ${claim.businessPurpose}`, muted: true }] : [])] },
            cell(status(claim.status)), cell(formatPayrollMoney(claim.amountCents), true),
            cell(['approved', 'partially_approved', 'reimbursed'].includes(claim.status) ? formatPayrollMoney(claim.approvedAmountCents ?? claim.amountCents) : '—', true)]));
    const next = snapshot.nextMonthPreview;
    if (next)
        table('Vorschau auf den Folgemonat', `${month(next.periodYear, next.periodMonth)} · ${next.assignments.length} ${next.assignments.length === 1 ? 'Einsatz' : 'Einsätze'}`, `Gespeicherter Einsatzplan: ${formatPayrollMinutes(next.totalPlannedMinutes)} Diese Vorschau enthält keine bereits verdiente Vergütung.`, [{ label: 'Datum', width: 22 }, { label: 'Klient:in / Einsatz', width: 92 }, { label: 'Geplante Zeit', width: 33 }, { label: 'Status', width: 31 }], next.assignments.map(line => assignmentCells(line, false, false)));
    const pageCount = pdf.getNumberOfPages();
    for (let page = 1; page <= pageCount; page++) {
        pdf.setPage(page);
        pdf.setDrawColor(RULE);
        pdf.setLineWidth(0.25);
        pdf.line(margin, 283, margin + width, 283);
        font(7, false, MUTED);
        text(`${period} · Version ${version} · Bruttowerte · Zeiten: Europe/Berlin`, margin, 288);
        font(7, true, BLUE);
        text(`Seite ${page} von ${pageCount}`, margin + width, 288, { align: 'right' });
    }
    pdf.setCreationDate(generated);
    pdf.setProperties({ title: `Gehaltsübersicht ${period} · ${snapshot.employeeName}`, author: 'CareSuite HealthOS', creator: 'CareSuite HealthOS', subject: `Monatsübersicht · Version ${version}` });
    return { bytes: new Uint8Array(pdf.output('arraybuffer')), pageCount };
}
