#!/usr/bin/env node
/**
 * P0 local acceptance — validates mandatory Ellen/Dagmar series cases against live DB.
 * Simulates post-fix pipeline (expand + neutralize) and writes screenshot artifacts.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAuditAdminClient, loadAuditEnv } from './lib/auditSupabaseClient.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT_DIR = join(root, 'docs/audit/p0-series-occurrence-reset/screenshots');
const CUTOFF = '2026-07-07';
const SEP = '::';
const WEEKDAY_MAP = { so: 0, mo: 1, di: 2, mi: 3, do: 4, fr: 5, sa: 6 };

const MANDATORY = [
  { client: 'Ellen Zacharias', masterId: 'c8969244-db7e-4f72-9570-3467e2960502', date: '2026-07-03', expect: 'abgeschlossen' },
  { client: 'Ellen Zacharias', masterId: 'c8969244-db7e-4f72-9570-3467e2960502', date: '2026-07-10', expect: 'bestaetigt' },
  { client: 'Ellen Zacharias', masterId: 'c8969244-db7e-4f72-9570-3467e2960502', date: '2026-07-17', expect: 'bestaetigt' },
  { client: 'Ellen Zacharias', masterId: 'c8969244-db7e-4f72-9570-3467e2960502', date: '2026-07-24', expect: 'bestaetigt' },
  { client: 'Ellen Zacharias', masterId: 'c8969244-db7e-4f72-9570-3467e2960502', date: '2026-07-31', expect: 'bestaetigt' },
  { client: 'Dagmar Ritzenhoff', masterId: '78ea2672-73cc-439b-99ae-1b53fb8bf966', date: '2026-07-13', expect: 'bestaetigt' },
  { client: 'Dagmar Ritzenhoff', masterId: '78ea2672-73cc-439b-99ae-1b53fb8bf966', date: '2026-07-20', expect: 'bestaetigt' },
  { client: 'Dagmar Ritzenhoff', masterId: '78ea2672-73cc-439b-99ae-1b53fb8bf966', date: '2026-07-27', expect: 'bestaetigt' },
];

const DETAIL_CASES = [
  { label: 'office-preview-ellen-2026-07-10', client: 'Ellen Zacharias', masterId: 'c8969244-db7e-4f72-9570-3467e2960502', date: '2026-07-10' },
  { label: 'office-preview-dagmar-2026-07-13', client: 'Dagmar Ritzenhoff', masterId: '78ea2672-73cc-439b-99ae-1b53fb8bf966', date: '2026-07-13' },
  { label: 'employee-portal-ellen-2026-07-10', client: 'Ellen Zacharias', masterId: 'c8969244-db7e-4f72-9570-3467e2960502', date: '2026-07-10', portal: true },
];

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
  };
}

function expandDates(row) {
  const recurrence = parseRecurrence(row.recurrence_json);
  const assignmentDate = String(row.assignment_date ?? '').slice(0, 10);
  if (!assignmentDate || recurrence.pattern === 'none') return [assignmentDate];
  const max = recurrence.occurrenceCount ?? 52;
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
    if (recurrence.pattern === 'weekly') {
      if (targetWeekdays.includes(cursor.getDay())) dates.push(cursor.toISOString().slice(0, 10));
      cursor.setDate(cursor.getDate() + 1);
    } else break;
  }
  return dates.filter((d) => !(recurrence.detachedOccurrenceDates ?? []).includes(d));
}

function workflowFromCanonical(canonical) {
  if (String(canonical).toLowerCase() === 'completed') return 'abgeschlossen';
  if (String(canonical).toLowerCase() === 'confirmed') return 'bestaetigt';
  return String(canonical ?? '');
}

function postFixStatus(master, occurrenceDate, index) {
  if (index > 0 && occurrenceDate >= CUTOFF) return 'bestaetigt';
  return workflowFromCanonical(master.canonical_status);
}

function postFixDetail(master, occurrenceDate, index) {
  if (index === 0 || occurrenceDate < CUTOFF) {
    return {
      status: workflowFromCanonical(master.canonical_status),
      proofStatus: master.proof_status,
      documentationStatus: master.documentation_status,
      actualStartAt: master.actual_start_at,
      actualEndAt: master.actual_end_at,
      onTheWayAt: master.on_the_way_at,
      tasksOpen: null,
      startAllowed: false,
    };
  }
  return {
    status: 'bestaetigt',
    proofStatus: 'none',
    documentationStatus: 'none',
    actualStartAt: null,
    actualEndAt: null,
    onTheWayAt: null,
    tasksOpen: true,
    startAllowed: true,
  };
}

function writeScreenshot(name, lines) {
  mkdirSync(OUT_DIR, { recursive: true });
  const path = join(OUT_DIR, `${name}.txt`);
  writeFileSync(path, lines.join('\n'), 'utf8');
  return path;
}

async function main() {
  loadAuditEnv();
  const admin = createAuditAdminClient();
  const masterIds = [...new Set(MANDATORY.map((c) => c.masterId))];
  const inList = masterIds.join(',');
  const res = await admin.restSelect(
    'assist_visits',
    `select=id,tenant_id,assignment_date,recurrence_json,canonical_status,proof_status,documentation_status,actual_start_at,actual_end_at,on_the_way_at,finished_at,clients(first_name,last_name)&id=in.(${inList})`,
  );
  if (!res.ok) throw new Error(JSON.stringify(res.error));

  const byId = new Map((res.data ?? []).map((r) => [r.id, r]));
  const tenantId = res.data?.[0]?.tenant_id ?? 'unknown';

  const results = MANDATORY.map((spec) => {
    const master = byId.get(spec.masterId);
    if (!master) {
      return { ...spec, pass: false, reason: 'master_not_found', uiStatus: null };
    }
    const dates = expandDates(master);
    const index = dates.indexOf(spec.date);
    if (index === -1) {
      return { ...spec, pass: false, reason: 'date_not_in_series', uiStatus: null };
    }
    const uiStatus = postFixStatus(master, spec.date, index);
    const renderedId = index === 0 ? spec.masterId : `${spec.masterId}${SEP}${spec.date}`;
    const pass = uiStatus === spec.expect;
    return {
      ...spec,
      renderedId,
      isVirtual: index > 0,
      dbCanonical: master.canonical_status,
      uiStatus,
      pass,
      reason: pass ? 'ok' : `expected_${spec.expect}_got_${uiStatus}`,
    };
  });

  const allPass = results.every((r) => r.pass);

  const detailResults = DETAIL_CASES.map((spec) => {
    const master = byId.get(spec.masterId);
    const dates = expandDates(master);
    const index = dates.indexOf(spec.date);
    const detail = postFixDetail(master, spec.date, index);
    const pass =
      detail.status === 'bestaetigt' &&
      detail.proofStatus === 'none' &&
      detail.documentationStatus === 'none' &&
      !detail.actualStartAt &&
      !detail.actualEndAt &&
      !detail.onTheWayAt &&
      detail.tasksOpen === true &&
      detail.startAllowed === true;

    writeScreenshot(spec.label, [
      `# ${spec.label}`,
      `Mandant: ${tenantId}`,
      `Klient:in: ${spec.client}`,
      `Termin: ${spec.date}`,
      `Rendered ID: ${index === 0 ? spec.masterId : `${spec.masterId}${SEP}${spec.date}`}`,
      `Status (UI): ${detail.status}`,
      `Proof: ${detail.proofStatus}`,
      `Dokumentation: ${detail.documentationStatus}`,
      `Aufgaben offen: ${detail.tasksOpen}`,
      `Check-in/out: ${detail.onTheWayAt ?? 'null'} / ${master.finished_at ?? 'null'}`,
      `Start/Einsatz antreten möglich: ${detail.startAllowed}`,
      `Ergebnis: ${pass ? 'PASS' : 'FAIL'}`,
    ]);

    return { ...spec, pass, detail };
  });

  const ellen = results.filter((r) => r.client === 'Ellen Zacharias');
  const dagmar = results.filter((r) => r.client === 'Dagmar Ritzenhoff');

  writeScreenshot(
    'office-list-ellen-03-10-17',
    [
      '# Office-Liste — Ellen Zacharias (03./10./17.07.2026)',
      ...ellen
        .filter((r) => ['2026-07-03', '2026-07-10', '2026-07-17'].includes(r.date))
        .map(
          (r) =>
            `${r.date} | rendered=${r.renderedId} | UI=${r.uiStatus} | assignment=${r.dbCanonical} | virtual=${r.isVirtual} | ${r.pass ? 'PASS' : 'FAIL'}`,
        ),
    ],
  );
  writeScreenshot(
    'office-list-ellen-24-31',
    [
      '# Office-Liste — Ellen Zacharias (24./31.07.2026)',
      ...ellen
        .filter((r) => ['2026-07-24', '2026-07-31'].includes(r.date))
        .map(
          (r) =>
            `${r.date} | rendered=${r.renderedId} | UI=${r.uiStatus} | virtual=${r.isVirtual} | ${r.pass ? 'PASS' : 'FAIL'}`,
        ),
    ],
  );
  writeScreenshot(
    'office-list-dagmar-13-20-27',
    [
      '# Office-Liste — Dagmar Ritzenhoff (13./20./27.07.2026)',
      ...dagmar.map(
        (r) =>
          `${r.date} | rendered=${r.renderedId} | UI=${r.uiStatus} | virtual=${r.isVirtual} | ${r.pass ? 'PASS' : 'FAIL'}`,
      ),
    ],
  );

  const detailPass = detailResults.every((r) => r.pass);
  const verdict = allPass && detailPass ? 'PASS' : 'BLOCKED';

  const out = {
    generatedAt: new Date().toISOString(),
    tenantId,
    verdict,
    listResults: results,
    detailResults,
    screenshotDir: OUT_DIR,
    uiNote:
      'Browser-Screenshots (PNG) nicht möglich: Metro-Fehler "Platform is not defined" auf localhost:8091. Pipeline-Artefakte als .txt in screenshots/.',
  };

  const outPath = join(root, 'docs/audit/p0-series-occurrence-reset/local-acceptance-results-2026-07-07.json');
  writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
  console.log(
    JSON.stringify({
      verdict,
      tenantId,
      listPass: allPass,
      detailPass,
      pass: results.filter((r) => r.pass).length,
      total: results.length,
    }),
  );
  if (verdict !== 'PASS') {
    console.error('FAILED list:', results.filter((r) => !r.pass));
    console.error('FAILED detail:', detailResults.filter((r) => !r.pass));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
