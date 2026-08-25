import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import type { LogbookDailyConfirmation, LogbookReceipt, LogbookSegment, LogbookTrip, LogbookVehicle } from '@/types/modules/employeeLogbook';
import { isLogbookTripInBerlinRange } from './employeeLogbookDate';
import { TRAVEL_ROUTE_TYPE_LABELS } from '@/types/modules/travelCompensation';

function escapeHtml(value: string) { return value.replace(/[&<>"']/g, (character) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[character] ?? character); }

export async function buildLogbookPdf(input: { employeeName: string; from: string; to: string; trips: LogbookTrip[]; vehicles: LogbookVehicle[]; segments?: LogbookSegment[]; receipts?: LogbookReceipt[]; confirmations?: LogbookDailyConfirmation[] }) {
  const selected = input.trips.filter((trip) => isLogbookTripInBerlinRange(trip.startedAt, input.from, input.to));
  const totalTrips = selected.filter((trip) => ['completed', 'corrected', 'confirmed'].includes(trip.status));
  const totalKm = totalTrips.reduce((sum, trip) => sum + trip.distanceFinalKm, 0);
  const totalCents = totalTrips.reduce((sum, trip) => sum + trip.mileageAmountCents, 0);
  if (Platform.OS !== 'web') {
    const rows = selected.map((trip) => {
      const vehicle = input.vehicles.find((item) => item.id === trip.vehicleId);
      const stops = (input.segments ?? []).filter((segment) => segment.tripId === trip.id).sort((a, b) => a.sequenceNo - b.sequenceNo);
      const receipts = (input.receipts ?? []).filter((receipt) => receipt.tripId === trip.id);
      return `<tr><td>${escapeHtml(new Date(trip.startedAt).toLocaleString('de-DE'))}<br>${escapeHtml(trip.endedAt ? new Date(trip.endedAt).toLocaleString('de-DE') : 'nicht beendet')}</td><td>${escapeHtml(TRAVEL_ROUTE_TYPE_LABELS[trip.routeType])}<br>${escapeHtml(trip.purpose)}<br>ID ${escapeHtml(trip.id)}</td><td>${escapeHtml(trip.startAddress ?? 'GPS-Start')} → ${escapeHtml(trip.endAddress ?? 'GPS-Ziel')}<br>${escapeHtml(vehicle?.plate ?? 'Fahrzeug fehlt')}</td><td>${trip.distanceFinalKm.toFixed(2)}<br>${trip.gpsCaptured ? 'GPS' : 'manuell'}</td><td>${(trip.mileageAmountCents / 100).toFixed(2)} €</td><td>${escapeHtml(trip.status)}<br>${trip.countsAsWorkTime ? 'Arbeitszeit' : `${trip.worktimeDeductionMinutes} Min. Abzug`}<br>${stops.length} Stopps · ${receipts.length} Belege</td></tr>`;
    }).join('');
    const confirmations = (input.confirmations ?? []).filter((item) => item.workDate >= input.from && item.workDate <= input.to).map((item) => `${escapeHtml(item.workDate)} · ${escapeHtml(item.signerName)} · ${item.tripCount} Fahrten · ${item.distanceKm.toFixed(2)} km`).join('<br>') || 'Keine Tagesbestätigung im Zeitraum';
    const html = `<html><head><meta charset="utf-8"><style>@page{size:A4 landscape;margin:12mm}body{font-family:Arial;color:#10243d;margin:0}h1{color:#075dbf;margin:0 0 6px}table{width:100%;border-collapse:collapse;font-size:9px;table-layout:fixed}th,td{border:1px solid #bdd7f2;padding:7px;text-align:left;vertical-align:top;overflow-wrap:anywhere}th{background:#eaf4ff}.summary{padding:12px;background:#eaf4ff;margin:12px 0}.confirmations{page-break-inside:avoid}</style></head><body><h1>CareSuite HealthOS · Fahrtenbuch</h1><p>${escapeHtml(input.employeeName)} · ${input.from} bis ${input.to}</p><div class="summary"><strong>${totalTrips.length} abgeschlossene Fahrten · ${totalKm.toFixed(2)} km · ${(totalCents / 100).toFixed(2)} EUR</strong><br>Erstellt: ${escapeHtml(new Date().toLocaleString('de-DE'))}</div><table><thead><tr><th>Zeit</th><th>Fahrt</th><th>Route/Fahrzeug</th><th>km/Quelle</th><th>Erstattung</th><th>Status/Nachweise</th></tr></thead><tbody>${rows}</tbody></table><section class="confirmations"><h3>Tagesbestätigungen</h3><p>${confirmations}</p></section></body></html>`;
    const file = await Print.printToFileAsync({ html });
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', dialogTitle: 'Fahrtenbuch teilen' });
    return;
  }
  const module = await import('jspdf/dist/jspdf.es.min.js');
  const JsPDF = (module as unknown as typeof import('jspdf')).jsPDF;
  const pdf = new JsPDF({ unit: 'mm', format: 'a4' });
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(18); pdf.text('CareSuite HealthOS · Fahrtenbuch', 14, 18);
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10); pdf.text(`${input.employeeName} · ${input.from} bis ${input.to}`, 14, 25);
  const maxWidth = 182;
  let y = 35;
  const ensureSpace = (height: number) => {
    if (y + height <= 278) return;
    pdf.addPage();
    y = 16;
  };
  const write = (value: string, options?: { bold?: boolean; size?: number; color?: [number, number, number] }) => {
    const lines = pdf.splitTextToSize(value, maxWidth) as string[];
    const size = options?.size ?? 9;
    ensureSpace(lines.length * 4.2 + 1);
    pdf.setFont('helvetica', options?.bold ? 'bold' : 'normal');
    pdf.setFontSize(size);
    pdf.setTextColor(...(options?.color ?? [16, 36, 61]));
    pdf.text(lines, 14, y);
    y += lines.length * 4.2 + 1;
  };
  write(`${totalTrips.length} abgeschlossene Fahrten · ${totalKm.toFixed(2)} km · ${(totalCents / 100).toFixed(2)} EUR`, { bold: true, color: [7, 93, 191] });
  selected.forEach((trip) => {
    ensureSpace(35);
    const vehicle = input.vehicles.find((item) => item.id === trip.vehicleId);
    const start = new Date(trip.startedAt).toLocaleString('de-DE'); const end = trip.endedAt ? new Date(trip.endedAt).toLocaleString('de-DE') : 'läuft';
    const stopCount = (input.segments ?? []).filter((segment) => segment.tripId === trip.id).length;
    const receiptCount = (input.receipts ?? []).filter((receipt) => receipt.tripId === trip.id).length;
    pdf.setDrawColor(189, 215, 242);
    pdf.line(14, y, 196, y);
    y += 4;
    write(`${start} – ${end} · ${TRAVEL_ROUTE_TYPE_LABELS[trip.routeType]}`, { bold: true, size: 10 });
    write(`${trip.purpose} · ${trip.distanceFinalKm.toFixed(2)} km · ${((trip.mileageAmountCents || Math.round(trip.distanceFinalKm * trip.mileageRateCents)) / 100).toFixed(2)} EUR · ${trip.status}`);
    write(`${trip.startAddress ?? 'GPS-Start'} → ${trip.endAddress ?? 'GPS-Ziel'}${vehicle ? ` · ${vehicle.plate}` : ' · Fahrzeug fehlt'}`);
    write(`${trip.countsAsWorkTime ? 'Arbeitszeit' : `Fahrzeitabzug ${trip.worktimeDeductionMinutes} Min.`} · ${trip.gpsCaptured ? 'GPS' : 'manuell'} · ${stopCount} Stopps · ${receiptCount} Belege`);
    if (trip.correctedAt) write('Korrigierter Eintrag – Änderung revisionssicher protokolliert', { bold: true });
    write(`ID ${trip.id}`, { size: 7, color: [75, 97, 122] });
  });
  ensureSpace(24);
  pdf.setDrawColor(7, 93, 191);
  pdf.line(14, y, 196, y);
  y += 5;
  write(`Gesamt: ${totalKm.toFixed(2)} km · ${(totalCents / 100).toFixed(2)} EUR`, { bold: true, size: 11, color: [7, 93, 191] });
  const confirmations = (input.confirmations ?? []).filter((item) => item.workDate >= input.from && item.workDate <= input.to);
  write('Tagesbestätigungen', { bold: true, size: 11 });
  write(confirmations.length
    ? confirmations.map((item) => `${item.workDate} · ${item.signerName} · ${item.tripCount} Fahrten · ${item.distanceKm.toFixed(2)} km`).join('\n')
    : 'Keine Tagesbestätigung im Zeitraum');
  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    pdf.setPage(page);
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(75, 97, 122);
    pdf.text(`Seite ${page} von ${pages}`, 196, 290, { align: 'right' });
  }
  pdf.save(`CareSuite-Fahrtenbuch-${input.from}-${input.to}.pdf`);
}
