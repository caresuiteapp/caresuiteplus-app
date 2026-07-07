#!/usr/bin/env node
/**
 * P0 DATA CLEANUP — Serien-Einsätze anstehend zurücksetzen
 *
 * Setzt fälschlich als abgeschlossen/in Durchführung markierte zukünftige
 * Serien-Vorkommen (ab Stichtag) auf bestätigt/offen zurück — ohne echte
 * Nachweise, Signaturen oder vergangene Termine zu beschädigen.
 *
 * Usage:
 *   node scripts/audit/p0SeriesOccurrenceExecutionReset.mjs              # dry-run (default)
 *   node scripts/audit/p0SeriesOccurrenceExecutionReset.mjs --write       # apply resets
 *   node scripts/audit/p0SeriesOccurrenceExecutionReset.mjs --tenant=UUID
 *
 * Output: docs/audit/p0-series-occurrence-reset/report-<timestamp>.json
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAuditAdminClient, loadAuditEnv } from './lib/auditSupabaseClient.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CUTOFF_DATE = '2026-07-07';
const WRITE = process.argv.includes('--write');
const tenantArg = process.argv.find((a) => a.startsWith('--tenant='));
const TENANT_FILTER = tenantArg ? tenantArg.split('=')[1] : null;

const RESET_CANONICAL = 'confirmed';
const RESET_EXECUTION = 'pending';
const RESET_DOCUMENTATION = 'none';
const RESET_PROOF = 'none';

const EXECUTION_LIKE_STATUSES = new Set([
  'on_the_way',
  'arrived',
  'started',
  'paused',
  'finished',
  'documentation_open',
  'signature_open',
  'completed',
  'unterwegs',
  'angekommen',
  'gestartet',
  'pausiert',
  'beendet',
  'dokumentation_offen',
  'unterschrift_offen',
  'abgeschlossen',
  'in_bearbeitung',
  'in_ausfuehrung',
  'eingetroffen',
  'dokumentiert',
]);

const PROTECTED_TERMINAL = new Set([
  'cancelled',
  'storniert',
  'abgesagt_klient',
  'abgesagt_team',
  'no_show',
  'nicht_erschienen',
  'nicht_erledigt',
  'abgerechnet',
  'archiviert',
]);

const BILLING_LOCKED = new Set(['exported', 'billed', 'invoiced', 'locked', 'released', 'abgerechnet']);

const WEEKDAY_MAP = { so: 0, mo: 1, di: 2, mi: 3, do: 4, fr: 5, sa: 6 };

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
    parentSeriesId: typeof obj.parentSeriesId === 'string' ? obj.parentSeriesId : null,
    sourceOccurrenceDate:
      typeof obj.sourceOccurrenceDate === 'string' ? obj.sourceOccurrenceDate : null,
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
      if (cursor.getDay() === start.getDay() && recurrence.pattern === 'biweekly') {
        if (dates.length > 0 && dates.length % targetWeekdays.length === 0) {
          cursor.setDate(cursor.getDate() + 7);
        }
      }
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

function isMaterializedVisit(row) {
  const recurrence = parseRecurrence(row.recurrence_json);
  const catalog = row.catalog_snapshot_json ?? {};
  return Boolean(
    recurrence.parentSeriesId ||
      recurrence.sourceOccurrenceDate ||
      catalog.materializedFromSeriesId ||
      catalog.sourceOccurrenceDate,
  );
}

function isSeriesMaster(row) {
  return parseRecurrence(row.recurrence_json).pattern !== 'none';
}

function dateGteCutoff(dateKey) {
  return Boolean(dateKey && dateKey >= CUTOFF_DATE);
}

function looksExecuted(row) {
  const status = String(row.canonical_status ?? '').toLowerCase();
  if (EXECUTION_LIKE_STATUSES.has(status)) return true;
  if (row.execution_status && row.execution_status !== 'pending') return true;
  if (row.on_the_way_at || row.arrived_at || row.actual_start_at || row.actual_end_at) return true;
  if (row.finished_at) return true;
  if (row.documentation_status && !['none', 'open', 'pending'].includes(row.documentation_status)) {
    return true;
  }
  if (row.proof_status && !['none', 'open', 'pending', 'not_created'].includes(row.proof_status)) {
    return true;
  }
  return false;
}

function buildVisitOccurrenceId(visitId, occurrenceDate) {
  return `${visitId}::${occurrenceDate}`;
}

async function restDelete(admin, table, filterQuery) {
  const res = await fetch(`${admin.url}/rest/v1/${table}?${filterQuery}`, {
    method: 'DELETE',
    headers: {
      apikey: admin.key,
      Authorization: `Bearer ${admin.key}`,
      Prefer: 'return=minimal',
    },
  });
  if (!res.ok) {
    const text = await res.text();
    return { ok: false, error: text.slice(0, 500) };
  }
  return { ok: true };
}

async function restInsert(admin, table, row) {
  const res = await fetch(`${admin.url}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: admin.key,
      Authorization: `Bearer ${admin.key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    const text = await res.text();
    return { ok: false, error: text.slice(0, 500) };
  }
  return { ok: true };
}

async function fetchAllVisits(admin) {
  const select =
    'id,tenant_id,title,assignment_date,planned_start_at,planned_end_at,recurrence_json,catalog_snapshot_json,legacy_assignment_id,canonical_status,execution_status,documentation_status,proof_status,billing_status,planning_status,on_the_way_at,arrived_at,finished_at,actual_start_at,actual_end_at,employee_notes';

  const queries = [
    `${select}&recurrence_json->>pattern=neq.none`,
    `${select}&recurrence_json->>parentSeriesId=not.is.null`,
  ];

  const byId = new Map();
  for (const q of queries) {
    const tenantPart = TENANT_FILTER ? `&tenant_id=eq.${TENANT_FILTER}` : '';
    const res = await admin.restSelect('assist_visits', `select=${q}${tenantPart}`);
    if (!res.ok) throw new Error(`assist_visits load failed: ${JSON.stringify(res.error)}`);
    for (const row of res.data ?? []) {
      byId.set(row.id, row);
    }
  }

  return [...byId.values()];
}

async function fetchArtifacts(admin, visitIds) {
  if (visitIds.length === 0) {
    return {
      docs: new Map(),
      signatures: new Set(),
      proofs: new Set(),
      timeEvents: new Map(),
      executionStates: new Map(),
    };
  }

  const inList = visitIds.join(',');
  const tenantPart = TENANT_FILTER ? `&tenant_id=eq.${TENANT_FILTER}` : '';

  const [docsRes, sigRes, proofRes, eventsRes, stateRes] = await Promise.all([
    admin.restSelect(
      'assist_visit_documentation',
      `select=visit_id,short_description,special_notes&visit_id=in.(${inList})${tenantPart}`,
    ),
    admin.restSelect(
      'assist_visit_signatures',
      `select=visit_id&visit_id=in.(${inList})&is_valid=eq.true${tenantPart}`,
    ),
    admin.restSelect('assist_visit_proofs', `select=visit_id,status,billing_released&visit_id=in.(${inList})${tenantPart}`),
    admin.restSelect(
      'assist_time_events',
      `select=visit_id,event_type,occurred_at&visit_id=in.(${inList})${tenantPart}`,
    ),
    admin.restSelect(
      'assist_visit_execution_state',
      `select=visit_id,travel_started_at,service_started_at,service_ended_at,documentation_complete,signature_complete,proof_generated&visit_id=in.(${inList})${tenantPart}`,
    ),
  ]);

  const docs = new Map();
  for (const row of docsRes.data ?? []) {
    const text = [row.short_description, row.special_notes]
      .filter((v) => typeof v === 'string' && v.trim())
      .join(' ')
      .trim();
    if (text) docs.set(row.visit_id, text);
  }

  const signatures = new Set((sigRes.data ?? []).map((r) => r.visit_id));
  const proofs = new Set((proofRes.data ?? []).map((r) => r.visit_id));

  const timeEvents = new Map();
  for (const row of eventsRes.data ?? []) {
    const list = timeEvents.get(row.visit_id) ?? [];
    list.push(row);
    timeEvents.set(row.visit_id, list);
  }

  const executionStates = new Map();
  for (const row of stateRes.data ?? []) {
    executionStates.set(row.visit_id, row);
  }

  return { docs, signatures, proofs, timeEvents, executionStates, proofRows: proofRes.data ?? [] };
}

function hasRealExecutionEvidence(visitId, row, artifacts, assignmentRow) {
  const status = String(row.canonical_status ?? '').toLowerCase();
  if (PROTECTED_TERMINAL.has(status)) {
    return { protected: true, reason: `terminal_status:${status}` };
  }

  if (BILLING_LOCKED.has(String(row.billing_status ?? '').toLowerCase())) {
    return { protected: true, reason: `billing_locked:${row.billing_status}` };
  }

  if (artifacts.signatures.has(visitId)) {
    return { protected: true, reason: 'valid_signature' };
  }

  if (artifacts.docs.has(visitId)) {
    return { protected: true, reason: 'documentation' };
  }

  const proofRow = (artifacts.proofRows ?? []).find((p) => p.visit_id === visitId);
  if (proofRow) {
    if (proofRow.billing_released) {
      return { protected: true, reason: 'proof_billing_released' };
    }
    if (proofRow.status && !['draft', 'open'].includes(String(proofRow.status).toLowerCase())) {
      return { protected: true, reason: `proof_status:${proofRow.status}` };
    }
    if (proofRow.status) {
      return { protected: true, reason: 'proof_exists' };
    }
  }

  if (assignmentRow?.documentation_notes?.trim()) {
    return { protected: true, reason: 'assignment_documentation_notes' };
  }

  const state = artifacts.executionStates.get(visitId);
  if (state?.documentation_complete || state?.signature_complete || state?.proof_generated) {
    return { protected: true, reason: 'execution_state_artifacts' };
  }

  const events = artifacts.timeEvents.get(visitId) ?? [];
  const plannedDate = String(row.assignment_date ?? row.planned_start_at ?? '').slice(0, 10);
  const sameDayEvents = events.filter((e) => String(e.occurred_at ?? '').slice(0, 10) === plannedDate);
  const hasSameDayService = sameDayEvents.some((e) =>
    ['service_start', 'service_end', 'drive_start', 'arrive'].includes(e.event_type),
  );
  if (hasSameDayService) {
    return { protected: true, reason: 'same_day_time_events' };
  }

  if (events.length > 0 && !hasSameDayService) {
    return { protected: false, reason: 'orphan_time_events_from_master', orphanEvents: events.length };
  }

  if (state?.travel_started_at || state?.service_started_at || state?.service_ended_at) {
    const travelDay = String(state.travel_started_at ?? state.service_started_at ?? '').slice(0, 10);
    if (travelDay && travelDay === plannedDate) {
      return { protected: true, reason: 'execution_state_same_day' };
    }
    return { protected: false, reason: 'execution_state_inherited', state };
  }

  if (row.on_the_way_at || row.arrived_at || row.actual_start_at || row.actual_end_at) {
    const stamp =
      row.actual_start_at ?? row.on_the_way_at ?? row.arrived_at ?? row.actual_end_at ?? null;
    const stampDay = String(stamp ?? '').slice(0, 10);
    if (stampDay && stampDay === plannedDate) {
      return { protected: true, reason: 'timestamps_same_day' };
    }
    return { protected: false, reason: 'timestamps_inherited_from_master' };
  }

  return { protected: false, reason: 'no_real_execution_evidence' };
}

function buildResetPatch() {
  const now = new Date().toISOString();
  return {
    canonical_status: RESET_CANONICAL,
    execution_status: RESET_EXECUTION,
    documentation_status: RESET_DOCUMENTATION,
    proof_status: RESET_PROOF,
    on_the_way_at: null,
    arrived_at: null,
    finished_at: null,
    actual_start_at: null,
    actual_end_at: null,
    employee_notes: null,
    is_incomplete: false,
    updated_at: now,
  };
}

function buildAssignmentResetPatch() {
  return {
    status: RESET_CANONICAL,
    on_the_way_at: null,
    arrived_at: null,
    finished_at: null,
    actual_start_at: null,
    actual_end_at: null,
    documentation_notes: null,
  };
}

async function applyReset(admin, visit, reportEntry) {
  const visitPatch = buildResetPatch();
  const visitFilter = `id=eq.${visit.id}&tenant_id=eq.${visit.tenant_id}`;
  const visitResult = await admin.restPatch('assist_visits', visitFilter, visitPatch);
  if (!visitResult.ok) {
    reportEntry.error = visitResult.error;
    return false;
  }

  if (visit.legacy_assignment_id) {
    const assignmentFilter = `id=eq.${visit.legacy_assignment_id}&tenant_id=eq.${visit.tenant_id}`;
    await admin.restPatch('assignments', assignmentFilter, buildAssignmentResetPatch());
    await admin.restPatch(
      'assignment_tasks',
      `assignment_id=eq.${visit.legacy_assignment_id}&tenant_id=eq.${visit.tenant_id}`,
      { status: 'open', not_done_reason: null },
    );
  }

  await admin.restPatch(
    'assist_visit_tasks',
    `visit_id=eq.${visit.id}&tenant_id=eq.${visit.tenant_id}`,
    { status: 'open', not_done_reason: null, completed_at: null },
  );

  await restDelete(
    admin,
    'assist_time_events',
    `visit_id=eq.${visit.id}&tenant_id=eq.${visit.tenant_id}`,
  );

  await admin.restPatch(
    'assist_visit_execution_state',
    `visit_id=eq.${visit.id}&tenant_id=eq.${visit.tenant_id}`,
    {
      current_step: 'consent',
      assignment_status: RESET_CANONICAL,
      travel_started_at: null,
      travel_ended_at: null,
      service_started_at: null,
      service_ended_at: null,
      documentation_complete: false,
      signature_complete: false,
      proof_generated: false,
      finalized_at: null,
      updated_at: new Date().toISOString(),
    },
  );

  await restInsert(admin, 'assist_visit_audit_logs', {
    tenant_id: visit.tenant_id,
    visit_id: visit.id,
    action: 'p0_series_occurrence_reset',
    details: `P0 Cleanup ${CUTOFF_DATE}: Serien-Vorkommen auf bestätigt zurückgesetzt (kein echter Nachweis).`,
    actor_profile_id: null,
  });

  if (visit.legacy_assignment_id) {
    await restInsert(admin, 'assignment_audit_events', {
      tenant_id: visit.tenant_id,
      assignment_id: visit.legacy_assignment_id,
      action: 'p0_series_occurrence_reset',
      actor_name: 'System',
      from_status: visit.canonical_status,
      to_status: RESET_CANONICAL,
      details: `P0 Cleanup ${CUTOFF_DATE}: materialisierter Serientermin zurückgesetzt.`,
    });
  }

  reportEntry.resetApplied = true;
  return true;
}

async function main() {
  const env = loadAuditEnv();
  const admin = createAuditAdminClient(env);
  const outDir = join(root, 'docs/audit/p0-series-occurrence-reset');
  mkdirSync(outDir, { recursive: true });

  const report = {
    mode: WRITE ? 'write' : 'dry-run',
    cutoffDate: CUTOFF_DATE,
    timezone: 'Europe/Berlin',
    generatedAt: new Date().toISOString(),
    tenantFilter: TENANT_FILTER,
    summary: {
      seriesMastersChecked: 0,
      futureVirtualOccurrencesAffected: 0,
      materializedCandidatesChecked: 0,
      wouldReset: 0,
      resetApplied: 0,
      skippedProtected: 0,
      skippedNotExecuted: 0,
      skippedPastOrMasterAnchor: 0,
      errors: 0,
    },
    series: [],
    virtualOccurrences: [],
    materializedVisits: [],
    skipped: [],
    reset: [],
    confirmation: {
      historicalProofsUnchanged: true,
      signaturesUnchanged: true,
      pastOccurrencesBeforeCutoffUnchanged: true,
      note: 'Master-Serien mit Termin vor Stichtag werden nicht zurückgesetzt — nur UI-Isolation im Code.',
    },
  };

  if (!admin.url || !admin.key) {
    report.error = 'missing_service_role_or_url';
    const outPath = join(outDir, `report-error-${Date.now()}.json`);
    writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.error(JSON.stringify(report, null, 2));
    process.exit(2);
  }

  const visits = await fetchAllVisits(admin);
  const visitById = new Map(visits.map((v) => [v.id, v]));

  const materializedIds = new Set();
  const seriesMasters = [];

  for (const visit of visits) {
    if (isMaterializedVisit(visit)) materializedIds.add(visit.id);
    if (isSeriesMaster(visit)) seriesMasters.push(visit);
  }

  report.summary.seriesMastersChecked = seriesMasters.length;

  for (const master of seriesMasters) {
    const recurrence = parseRecurrence(master.recurrence_json);
    const dates = expandRecurrenceDates(master).filter((d) => dateGteCutoff(d));
    const masterDate = String(master.assignment_date ?? '').slice(0, 10);

    const seriesEntry = {
      masterId: master.id,
      tenantId: master.tenant_id,
      title: master.title,
      masterAssignmentDate: masterDate,
      futureOccurrenceDates: dates.filter((d) => d !== masterDate),
      materializedOccurrenceIds: [],
    };

    for (const dateKey of dates) {
      if (dateKey === masterDate && masterDate < CUTOFF_DATE) {
        report.summary.skippedPastOrMasterAnchor += 1;
        continue;
      }

      const materializedId = recurrence.materializedOccurrences?.[dateKey] ?? null;

      if (materializedId) {
        seriesEntry.materializedOccurrenceIds.push({ dateKey, visitId: materializedId });
        materializedIds.add(materializedId);
      } else if (dateKey !== masterDate) {
        report.summary.futureVirtualOccurrencesAffected += 1;
        report.virtualOccurrences.push({
          virtualId: buildVisitOccurrenceId(master.id, dateKey),
          masterId: master.id,
          occurrenceDate: dateKey,
          action: 'display_only_code_fix',
          note: 'Kein DB-Reset nötig — virtuelle Occurrence, Code isoliert Master-Status.',
        });
      }
    }

    report.series.push(seriesEntry);

    const masterDateGte = dateGteCutoff(masterDate);
    if (masterDateGte && looksExecuted(master) && !materializedIds.has(master.id)) {
      materializedIds.add(master.id);
    }
  }

  const missingMaterializedIds = [...materializedIds].filter((id) => !visitById.has(id));
  if (missingMaterializedIds.length > 0) {
    const tenantPart = TENANT_FILTER ? `&tenant_id=eq.${TENANT_FILTER}` : '';
    const select =
      'id,tenant_id,title,assignment_date,planned_start_at,planned_end_at,recurrence_json,catalog_snapshot_json,legacy_assignment_id,canonical_status,execution_status,documentation_status,proof_status,billing_status,planning_status,on_the_way_at,arrived_at,finished_at,actual_start_at,actual_end_at,employee_notes';
    const reload = await admin.restSelect(
      'assist_visits',
      `select=${select}&id=in.(${missingMaterializedIds.join(',')})${tenantPart}`,
    );
    if (!reload.ok) throw new Error(`materialized reload failed: ${JSON.stringify(reload.error)}`);
    for (const row of reload.data ?? []) {
      visitById.set(row.id, row);
    }
  }

  const allMaterializedVisitIds = [...materializedIds];
  report.summary.materializedCandidatesChecked = allMaterializedVisitIds.length;

  const assignmentIds = [
    ...new Set(
      allMaterializedVisitIds
        .map((id) => visitById.get(id)?.legacy_assignment_id)
        .filter(Boolean),
    ),
  ];

  const assignmentsById = new Map();
  if (assignmentIds.length > 0) {
    const tenantPart = TENANT_FILTER ? `&tenant_id=eq.${TENANT_FILTER}` : '';
    const res = await admin.restSelect(
      'assignments',
      `select=id,documentation_notes,status&id=in.(${assignmentIds.join(',')})${tenantPart}`,
    );
    for (const row of res.data ?? []) assignmentsById.set(row.id, row);
  }

  const artifacts = await fetchArtifacts(admin, allMaterializedVisitIds);

  for (const visitId of allMaterializedVisitIds) {
    const visit = visitById.get(visitId);
    if (!visit) {
      report.skipped.push({ visitId, reason: 'visit_not_found' });
      continue;
    }

    const assignmentDate = String(visit.assignment_date ?? visit.planned_start_at ?? '').slice(0, 10);
    const isMasterAnchorBeforeCutoff =
      isSeriesMaster(visit) && assignmentDate < CUTOFF_DATE && !isMaterializedVisit(visit);

    if (isMasterAnchorBeforeCutoff) {
      report.skipped.push({
        visitId,
        reason: 'series_master_anchor_before_cutoff',
        assignmentDate,
        note: 'Erster Serientermin — echte Historie bleibt erhalten.',
      });
      report.summary.skippedPastOrMasterAnchor += 1;
      continue;
    }

    if (!dateGteCutoff(assignmentDate)) {
      report.skipped.push({ visitId, reason: 'before_cutoff', assignmentDate });
      report.summary.skippedPastOrMasterAnchor += 1;
      continue;
    }

    if (!looksExecuted(visit)) {
      report.skipped.push({ visitId, reason: 'not_in_executed_state', assignmentDate });
      report.summary.skippedNotExecuted += 1;
      continue;
    }

    const assignmentRow = visit.legacy_assignment_id
      ? assignmentsById.get(visit.legacy_assignment_id)
      : null;
    const evidence = hasRealExecutionEvidence(visitId, visit, artifacts, assignmentRow);

    const entry = {
      visitId,
      tenantId: visit.tenant_id,
      title: visit.title,
      assignmentDate,
      canonicalStatus: visit.canonical_status,
      legacyAssignmentId: visit.legacy_assignment_id ?? null,
      evidence,
    };

    report.materializedVisits.push(entry);

    if (evidence.protected) {
      report.skipped.push({ visitId, reason: evidence.reason, assignmentDate });
      report.summary.skippedProtected += 1;
      continue;
    }

    report.summary.wouldReset += 1;
    report.reset.push(entry);

    if (WRITE) {
      const resetResult = { ...entry, resetApplied: false };
      const ok = await applyReset(admin, visit, resetResult);
      if (ok) report.summary.resetApplied += 1;
      else report.summary.errors += 1;
      resetResult.mode = 'write';
      report.reset[report.reset.length - 1] = resetResult;
    }
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = join(outDir, `report-${stamp}.json`);
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(JSON.stringify({
    mode: report.mode,
    outPath,
    summary: report.summary,
    resetIds: report.reset.map((r) => r.visitId),
    skippedReasons: report.skipped.reduce((acc, s) => {
      acc[s.reason] = (acc[s.reason] ?? 0) + 1;
      return acc;
    }, {}),
    confirmation: report.confirmation,
  }, null, 2));

  process.exit(report.summary.errors > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});
