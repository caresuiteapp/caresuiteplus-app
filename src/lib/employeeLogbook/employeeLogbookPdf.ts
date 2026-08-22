import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import type { LogbookTrip, LogbookVehicle } from '@/types/modules/employeeLogbook';

function escapeHtml(value: string) { return value.replace(/[&<>"']/g, (character) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[character] ?? character); }

export async function buildLogbookPdf(input: { employeeName: string; from: string; to: string; trips: LogbookTrip[]; vehicles: LogbookVehicle[] }) {
  const selected = input.trips.filter((trip) => trip.startedAt.slice(0, 10) >= input.from && trip.startedAt.slice(0, 10) <= input.to);
  if (Platform.OS !== 'web') {
    const rows = selected.map((trip) => `<tr><td>${escapeHtml(new Date(trip.startedAt).toLocaleString('de-DE'))}</td><td>${escapeHtml(trip.purpose)}</td><td>${escapeHtml(trip.startAddress ?? 'GPS-Start')} → ${escapeHtml(trip.endAddress ?? 'GPS-Ziel')}</td><td>${trip.distanceFinalKm.toFixed(2)}</td><td>${(trip.mileageAmountCents / 100).toFixed(2)} €</td><td>${trip.countsAsWorkTime ? 'Arbeitszeit' : `${trip.worktimeDeductionMinutes} Min. Abzug`}${trip.correctedAt ? ' · korrigiert' : ''}</td></tr>`).join('');
    const html = `<html><head><meta charset="utf-8"><style>body{font-family:Arial;color:#10243d;padding:24px}h1{color:#075dbf}table{width:100%;border-collapse:collapse;font-size:10px}th,td{border:1px solid #bdd7f2;padding:7px;text-align:left}th{background:#eaf4ff}</style></head><body><h1>CareSuite HealthOS · Fahrtenbuch</h1><p>${escapeHtml(input.employeeName)} · ${input.from} bis ${input.to}</p><table><thead><tr><th>Zeit</th><th>Zweck</th><th>Route</th><th>km</th><th>Erstattung</th><th>Zeitstatus</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
    const file = await Print.printToFileAsync({ html });
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', dialogTitle: 'Fahrtenbuch teilen' });
    return;
  }
  const module = await import('jspdf/dist/jspdf.es.min.js');
  const JsPDF = (module as unknown as typeof import('jspdf')).jsPDF;
  const pdf = new JsPDF({ unit: 'mm', format: 'a4' });
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(18); pdf.text('CareSuite HealthOS · Fahrtenbuch', 14, 18);
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10); pdf.text(`${input.employeeName} · ${input.from} bis ${input.to}`, 14, 25);
  let y = 36; let totalKm = 0; let totalCents = 0;
  selected.forEach((trip) => {
    if (y > 270) { pdf.addPage(); y = 18; }
    const vehicle = input.vehicles.find((item) => item.id === trip.vehicleId);
    const start = new Date(trip.startedAt).toLocaleString('de-DE'); const end = trip.endedAt ? new Date(trip.endedAt).toLocaleString('de-DE') : 'läuft';
    pdf.setFont('helvetica', 'bold'); pdf.text(`${start} – ${end}`, 14, y);
    pdf.setFont('helvetica', 'normal'); pdf.text(`${trip.purpose} · ${trip.distanceFinalKm.toFixed(2)} km · ${((trip.mileageAmountCents || Math.round(trip.distanceFinalKm * trip.mileageRateCents)) / 100).toFixed(2)} EUR`, 14, y + 5);
    pdf.text(`${trip.startAddress ?? 'GPS-Start'} → ${trip.endAddress ?? 'GPS-Ziel'}${vehicle ? ` · ${vehicle.plate}` : ''}`, 14, y + 10);
    if (!trip.countsAsWorkTime) pdf.text(`Fahrzeit nicht als Arbeitszeit: Abzug ${trip.worktimeDeductionMinutes} Min.`, 14, y + 15);
    if (trip.correctedAt) pdf.text('Korrigierter Eintrag – Änderung revisionssicher protokolliert', 14, y + 20);
    y += trip.correctedAt ? 29 : 24; totalKm += trip.distanceFinalKm; totalCents += trip.mileageAmountCents || Math.round(trip.distanceFinalKm * trip.mileageRateCents);
  });
  pdf.setFont('helvetica', 'bold'); pdf.text(`Gesamt: ${totalKm.toFixed(2)} km · ${(totalCents / 100).toFixed(2)} EUR`, 14, Math.min(y + 4, 282));
  pdf.save(`CareSuite-Fahrtenbuch-${input.from}-${input.to}.pdf`);
}
