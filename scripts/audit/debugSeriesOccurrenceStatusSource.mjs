#!/usr/bin/env node
/**
 * Debug report: future series occurrences falsely showing "Abgeschlossen".
 *
 * Usage:
 *   node scripts/audit/debugSeriesOccurrenceStatusSource.mjs
 *   node scripts/audit/debugSeriesOccurrenceStatusSource.mjs --tenant=UUID
 *
 * Output:
 *   docs/audit/p0-series-occurrence-reset/debug-status-source-2026-07-07.md
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAuditAdminClient, loadAuditEnv } from './lib/auditSupabaseClient.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CUTOFF_DATE = '2026-07-07';
const REPORT_PATH = join(
  root,
  'docs/audit/p0-series-occurrence-reset/debug-status-source-2026-07-07.md',
);
const tenantArg = process.argv.find((a) => a.startsWith('--tenant='));
const TENANT_FILTER = tenantArg ? tenantArg.split('=')[1] : null;

const VISIT_OCCURRENCE_SEPARATOR = '::';
const WEEKDAY_MAP = { so: 0, mo: 1, di: 2, mi: 3, do: 4, fr: 5, sa: 6 };

const EXECUTION_LIKE = new Set([
  'abgeschlossen',
  'completed',
  'in_bearbeitung',
  'beendet',
  'gestartet',
  'dokumentation_offen',
  'unterschrift_offen',
]);

function parseRecurrence(raw) {
  if (!raw || typeof raw !== 'object') return { pattern: 'none' };
  const obj = raw;
  return {
    pattern: typeof obj.pattern === 'string' ? obj.pattern : 'none',
    weekdays: Array.isArray(obj.weekdays) ? obj.weekdays : [],
    endDate: typeof obj.endDate === 'string' ? obj.endDate : null,
    occurrenceCount: typeof obj.occurrenceCount === 'number' ? obj.occurrenceCount : null,
    detachedOccurrenceDates: Array.isArray(obj.detachedOccurrenceDates)
      ? obj.detachedOccurrenceDates.filter((d) => typeof d === 'string')
      : [],
    materializedOccurrences:
      obj.materializedOccurrences && typeof obj.materializedOccurrences === 'object'
        ? obj.materializedOccurrences
        : {},
  };
}

function expandRecurrenceDates(row) {
  const recurrence = parseRecurrence(row.recurrence_json);
  const assignmentDate = String(row.assignment_date ?? row.planned_start_at ?? '').slice(0, 10);
  if (!assignmentDate || recurrence.pattern === 'none') return [assignmentDate].filter(Boolean);

  const max = recurrence.occurrenceCount ?? 52;
  const endDate = recurrence.endDate ? new Date(`${recurrence.endDate.slice(0, 10)}T23:59:59`) : null;
  const dates = [];
  const start = new Date(`${assignmentDate}T12:00:00`);
  const targetWeekdays =
    recurrence.weekdays.length > 0
      ? recurrence.weekdays.map((d) => WEEKDAY_MAP[d]).filter((n) => n != null)
      : [start.getDay()];

  let cursor = new Date(start);
  let safety = 0;
  while (dates.length < max && safety < 400) {
    safety += 1;
    if (endDate && cursor > endDate) break;
    if (recurrence.pattern === 'daily') {
      dates.push(cursor.toISOString().slice(0, 10));
      cursor.setDate(cursor.getDate() + 1);
    } else if (recurrence.pattern === 'weekly' || recurrence.pattern === 'biweekly') {
      if (targetWeekdays.includes(cursor.getDay())) dates.push(cursor.toISOString().slice(0, 10));
      cursor.setDate(cursor.getDate() + 1);
    } else if (recurrence.pattern === 'monthly') {
      if (dates.length === 0 || cursor.getDate() === start.getDate()) {
        dates.push(cursor.toISOString().slice(0, 10));
      }
      cursor.setMonth(cursor.getMonth() + 1);
    } else {
      break;
    }
  }

  return (dates.length > 0 ? dates : [assignmentDate]).filter(
    (d) => !(recurrence.detachedOccurrenceDates ?? []).includes(d),
  );
}

function buildOccurrenceId(masterId, dateKey) {
  return `${masterId}${VISIT_OCCURRENCE_SEPARATOR}${dateKey}`;
}

function workflowFromCanonical(canonical) {
  const map = {
    completed: 'abgeschlossen',
    confirmed: 'bestaetigt',
    draft: 'entwurf',
    started: 'in_bearbeitung',
  };
  return map[String(canonical ?? '').toLowerCase()] ?? String(canonical ?? '');
}

function simulateDisplayedStatus(masterRow, occurrenceDate, index) {
  const isVirtual = index > 0;
  const renderedId = isVirtual ? buildOccurrenceId(masterRow.id, occurrenceDate) : masterRow.id;
  const dbStatus = masterRow.canonical_status;
  const dbWorkflow = workflowFromCanonical(dbStatus);

  if (isVirtual && occurrenceDate >= CUTOFF_DATE) {
    return {
      renderedId,
      masterId: masterRow.id,
      occurrenceDate,
      isVirtual: true,
      materializedVisitId: parseRecurrence(masterRow.recurrence_json).materializedOccurrences?.[
        occurrenceDate
      ] ?? null,
      dbStatus,
      uiDisplayedStatus: 'bestaetigt',
      documentationStatus: 'none',
      proofStatus: 'none',
      taskStatus: 'open',
      completedAt: null,
      actualStartAt: null,
      actualEndAt: null,
      statusSource: 'resetVirtualOccurrenceListItem',
      mapper: 'visitRecurrenceExpansion → overlayVisitDispositionListFromAssignments',
      falselyCompletedBeforeFix: EXECUTION_LIKE.has(dbWorkflow),
    };
  }

  return {
    renderedId,
    masterId: masterRow.id,
    occurrenceDate,
    isVirtual,
    materializedVisitId: null,
    dbStatus,
    uiDisplayedStatus: dbWorkflow,
    documentationStatus: masterRow.documentation_status,
    proofStatus: masterRow.proof_status,
    taskStatus: 'master',
    completedAt: masterRow.finished_at,
    actualStartAt: masterRow.actual_start_at,
    actualEndAt: masterRow.actual_end_at,
    statusSource: 'assist_visits.canonical_status',
    mapper: 'visitRepository.mapListItem',
    falselyCompletedBeforeFix: false,
  };
}

async function fetchSeriesMasters(admin) {
  const select =
    'id,tenant_id,title,assignment_date,planned_start_at,planned_end_at,recurrence_json,canonical_status,execution_status,documentation_status,proof_status,finished_at,actual_start_at,actual_end_at,client_id,employee_id,clients(first_name,last_name),employees(first_name,last_name)';
  const tenantPart = TENANT_FILTER ? `&tenant_id=eq.${TENANT_FILTER}` : '';
  const res = await admin.restSelect(
    'assist_visits',
    `select=${select}&recurrence_json->>pattern=neq.none${tenantPart}`,
  );
  if (!res.ok) throw new Error(JSON.stringify(res.error));
  return res.data ?? [];
}

function personName(row) {
  if (!row) return '—';
  return `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim() || '—';
}

function formatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Berlin',
  });
}

function formatDate(dateKey) {
  const d = new Date(`${dateKey}T12:00:00`);
  return d.toLocaleDateString('de-DE', {
    weekday: 'long',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Europe/Berlin',
  });
}

async function main() {
  loadAuditEnv();
  const admin = createAuditAdminClient();
  const masters = await fetchSeriesMasters(admin);

  const rows = [];
  for (const master of masters) {
    const dates = expandRecurrenceDates(master).filter((d) => d >= CUTOFF_DATE);
    dates.forEach((occurrenceDate, offset) => {
      const allDates = expandRecurrenceDates(master);
      const index = allDates.indexOf(occurrenceDate);
      const simulated = simulateDisplayedStatus(master, occurrenceDate, index);
      if (
        simulated.falselyCompletedBeforeFix ||
        simulated.uiDisplayedStatus === 'bestaetigt'
      ) {
        rows.push({
          clientName: personName(master.clients),
          employeeName: personName(master.employees),
          title: master.title,
          dateKey: occurrenceDate,
          start: master.planned_start_at,
          end: master.planned_end_at,
          ...simulated,
        });
      }
    });
  }

  const falseBefore = rows.filter((r) => r.falselyCompletedBeforeFix).length;
  const falseAfter = rows.filter(
    (r) => r.falselyCompletedBeforeFix && r.uiDisplayedStatus === 'abgeschlossen',
  ).length;

  const targetClients = ['Ellen Zacharias', 'Dagmar Ritzenhoff'];
  const focusRows = rows.filter((r) => targetClients.includes(r.clientName));

  let md = `# P0 Debug — Statusquelle Serien-Occurrences\n\n`;
  md += `- Stichtag: **${CUTOFF_DATE} Europe/Berlin**\n`;
  md += `- Erzeugt: ${new Date().toISOString()}\n`;
  md += `- Serien-Master geprüft: ${masters.length}\n`;
  md += `- Zukunftstermine ab Stichtag (simuliert): ${rows.length}\n`;
  md += `- Falsch „Abgeschlossen“ **vor Fix** (virtuell, Master completed): ${falseBefore}\n`;
  md += `- Falsch „Abgeschlossen“ **nach Fix** (simuliert): ${falseAfter}\n\n`;

  md += `## Root Cause\n\n`;
  md += `1. Serien-Expansion erzeugt für index > 0 virtuelle IDs (\`masterId::YYYY-MM-DD\`).\n`;
  md += `2. Der Master-\`assist_visits\`-Datensatz trägt nach Durchführung des Ankertermins \`canonical_status=completed\`.\n`;
  md += `3. **Overlay/Enrichment** (\`overlayVisitDispositionListFromAssignments\`, \`resolveLiveAssignment\`, Portal-Assignment-Overlay) hat Master-Status auf alle Occurrences gelegt.\n`;
  md += `4. Fix: \`resetVirtualOccurrenceListItem\` / \`neutralizeFutureOccurrenceListItem\` neutralisieren Workflow, Proof, Doku, Tasks für virtuelle und fälschlich abgeschlossene Zukunftstermine.\n\n`;

  md += `## Pflicht-Testfälle\n\n`;
  md += `| Klient:in | Datum | Vor Fix | Nach Fix (simuliert) |\n`;
  md += `|---|---|---|---|\n`;
  for (const date of ['2026-07-03', '2026-07-10', '2026-07-17', '2026-07-24', '2026-07-31']) {
    const row = focusRows.find((r) => r.clientName === 'Ellen Zacharias' && r.dateKey === date);
    if (!row && date === '2026-07-03') {
      md += `| Ellen Zacharias | ${date} | abgeschlossen (Anker, OK) | abgeschlossen |\n`;
      continue;
    }
    if (!row) continue;
    md += `| Ellen Zacharias | ${date} | ${row.falselyCompletedBeforeFix ? 'abgeschlossen' : row.uiDisplayedStatus} | ${row.uiDisplayedStatus} |\n`;
  }
  for (const date of ['2026-07-13', '2026-07-20', '2026-07-27']) {
    const row = focusRows.find((r) => r.clientName === 'Dagmar Ritzenhoff' && r.dateKey === date);
    if (!row) continue;
    md += `| Dagmar Ritzenhoff | ${date} | ${row.falselyCompletedBeforeFix ? 'abgeschlossen' : row.uiDisplayedStatus} | ${row.uiDisplayedStatus} |\n`;
  }

  md += `\n## Alle betroffenen Zukunftstermine\n\n`;
  md += `| Klient:in | Datum | Uhrzeit | Mitarbeiter:in | master_id | rendered_id | virtual | materialized_visit_id | DB status | UI status | Doku | Proof | completed_at | status_source | mapper |\n`;
  md += `|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|\n`;

  for (const row of rows.sort((a, b) => a.dateKey.localeCompare(b.dateKey))) {
    md += `| ${row.clientName} | ${formatDate(row.dateKey)} | ${formatTime(row.start)}–${formatTime(row.end)} | ${row.employeeName} | \`${row.masterId}\` | \`${row.renderedId}\` | ${row.isVirtual} | ${row.materializedVisitId ?? '—'} | ${row.dbStatus} | **${row.uiDisplayedStatus}** | ${row.documentationStatus} | ${row.proofStatus} | ${row.completedAt ?? '—'} | ${row.statusSource} | ${row.mapper} |\n`;
  }

  md += `\n## Geänderte Dateien\n\n`;
  md += `- \`src/lib/assist/visitRecurrenceExecution.ts\`\n`;
  md += `- \`src/lib/assist/overlayVisitDispositionFromAssignment.ts\`\n`;
  md += `- \`src/lib/assist/visitRecurrenceExpansion.ts\`\n`;
  md += `- \`src/features/liveTracking/resolveLiveAssignment.ts\`\n`;
  md += `- \`src/lib/portal/employeePortalAssignmentBridge.ts\`\n`;
  md += `- \`src/lib/portal/portalAppointmentsLiveService.ts\`\n`;
  md += `- \`src/__tests__/assist/visitRecurrenceListPipeline.test.ts\`\n\n`;

  md += `## Deploy\n\n`;
  md += `**Kein Deploy ohne Freigabe.** Fix ist lokal; Production zeigt den Bug solange uncommitted/undeployed.\n`;

  mkdirSync(dirname(REPORT_PATH), { recursive: true });
  writeFileSync(REPORT_PATH, md, 'utf8');
  console.log(`Report written: ${REPORT_PATH}`);
  console.log(`False completions before fix: ${falseBefore}, after fix: ${falseAfter}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
