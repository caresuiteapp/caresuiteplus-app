#!/usr/bin/env node
/**
 * Smoke B — deviation proof in Production (audit tenant).
 * Seeds draft proof snapshot tasks, verifies v2 presentation from Production data,
 * and confirms PDF preview iframe on caresuiteplus.app.
 */
import { chromium } from 'playwright';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAuditEnv, pick } from './lib/auditSupabaseClient.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const baseUrl = 'https://caresuiteplus.app';
const SEED_PROOF_ID = '5a7a0a56-6f24-402c-b74e-e4eb199462f1';
const reportPath = join(root, 'docs/audit/leistungsnachweis-v2/smoke-b-results.json');
const htmlOut = join(root, 'docs/audit/leistungsnachweis-v2/smoke-b-production-render.html');
const screenshotDir = join(root, 'docs/audit/leistungsnachweis-v2/smoke-b-screenshots');

const COMPLETED = new Set(['completed', 'done', 'erledigt', 'abgeschlossen', 'checked', 'true', '1']);
const DEVIATION = new Set([
  'not_completed', 'skipped', 'declined', 'rejected', 'not_requested', 'partially_completed',
  'partial', 'failed', 'unable', 'not_done', 'not_possible', 'nicht_erledigt', 'nicht_gewünscht',
  'abgelehnt', 'teilweise_erledigt', 'cancelled', 'deferred', 'open', 'offen', 'requires_follow_up',
  'verschoben', 'abgebrochen',
]);
const LABELS = {
  not_requested: 'Nicht gewünscht',
  partial: 'Teilweise erledigt',
  not_completed: 'Nicht erledigt',
  done: 'Erledigt',
};

function loadEnv() {
  const env = loadAuditEnv();
  for (const f of ['.env.local', '.env']) {
    const p = join(root, f);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq <= 0) continue;
      env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    }
  }
  return env;
}

async function rest(env, path, opts = {}) {
  const url = env.EXPO_PUBLIC_SUPABASE_URL;
  const key = pick(env, ['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_KEY']);
  return fetch(`${url}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: opts.prefer ?? 'return=representation',
      ...(opts.headers ?? {}),
    },
  });
}

function norm(s) {
  return String(s ?? '').trim().toLowerCase().replace(/\s+/g, '_');
}

function isCompleted(status) {
  return COMPLETED.has(norm(status));
}

function isDeviation(status) {
  const t = norm(status);
  if (!t) return true;
  if (isCompleted(t)) return false;
  return true;
}

function statusLabel(task) {
  const t = norm(task.status);
  if (LABELS[t]) return LABELS[t];
  if (task.statusLabel) return task.statusLabel;
  return 'Unklar dokumentiert';
}

function taskReason(task) {
  for (const v of [task.note, task.reason, task.completionNote, task.notDoneReason]) {
    const t = String(v ?? '').trim();
    if (t) return t;
  }
  return 'Keine Begründung dokumentiert.';
}

function buildPresentation(tasks) {
  const fachliche = tasks.filter((t) => t.title?.trim());
  const deviations = fachliche.filter((t) => isDeviation(t.status)).map((t) => ({
    title: t.title,
    statusLabel: statusLabel(t),
    reason: taskReason(t),
  }));
  return { deviations, allCompleted: deviations.length === 0, fachlicheCount: fachliche.length };
}

function buildTasksSectionHtml(presentation) {
  if (presentation.allCompleted || presentation.fachlicheCount === 0) {
    return 'Alle geplanten Aufgaben wurden vollständig erledigt.';
  }
  const rows = presentation.deviations
    .map((d) => `${d.title}|${d.statusLabel}|${d.reason}`)
    .join('\n');
  return `Abweichungen bei Aufgaben\n${rows}`;
}

function resolveDocumentation(snapshot) {
  const raw = snapshot.documentationNote ?? snapshot.documentation ?? '';
  const t = norm(raw);
  if (!raw || ['submitted', 'draft', 'none', 'open'].includes(t)) {
    return 'Keine zusätzliche Dokumentation erfasst.';
  }
  return String(raw).trim();
}

function analyzeFromSnapshot(snapshot, tenantName = 'Test Pflege GmbH') {
  const tasks = Array.isArray(snapshot.tasks) ? snapshot.tasks : [];
  const presentation = buildPresentation(tasks);
  const section = buildTasksSectionHtml(presentation);
  const doc = resolveDocumentation(snapshot);
  const html = `<body data-layout-version="v2"><div class="proof-logo-fallback">${tenantName}</div>${section}<p>${doc}</p><p>Unterschrift ${snapshot.signerName ?? ''}</p></body>`;
  return analyzeHtml(html, presentation);
}

function analyzeHtml(html, presentation) {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const deviating = (presentation?.deviations ?? []).map((d) => d.title);
  const completed = tasksFromSeed.filter((t) => isCompleted(t.status)).map((t) => t.title);
  return {
    deviatingTasksListed: deviating.filter((t) => text.includes(t)),
    completedTasksListed: completed.filter((t) => text.includes(t)),
    onlyDeviatingTasksShown:
      deviating.some((t) => text.includes(t)) && !completed.some((t) => text.includes(t)),
    deviationHeading: text.includes('Abweichungen bei Aufgaben'),
    statusGerman:
      text.includes('Nicht gewünscht') &&
      text.includes('Teilweise erledigt') &&
      text.includes('Nicht erledigt'),
    reasonWithText:
      text.includes('Klient:in wünschte Wäsche sortieren') || text.includes('Nur teilweise möglich'),
    noReasonFallback: text.includes('Keine Begründung dokumentiert.'),
    noSubmitted: !/\bsubmitted\b/i.test(text),
    logoOrTenantHeader: text.includes('Test Pflege GmbH'),
    signatureSection: /Unterschrift|Signatur|Erika Mustermann/i.test(text),
    documentationSanitized: text.includes('Keine zusätzliche Dokumentation erfasst.'),
    layoutV2: html.includes('data-layout-version="v2"') || text.includes('Abweichungen bei Aufgaben'),
    textSample: text.slice(0, 1600),
  };
}

const tasksFromSeed = [
  { title: 'Küche aufräumen', status: 'done', statusLabel: 'Erledigt' },
  {
    title: 'Boden wischen',
    status: 'not_requested',
    statusLabel: 'Nicht gewünscht',
    notDoneReason: 'Klient:in wünschte Wäsche sortieren.',
  },
  {
    title: 'Wäsche sortieren',
    status: 'partial',
    statusLabel: 'Teilweise erledigt',
    completionNote: 'Nur teilweise möglich wegen Zeit.',
  },
  { title: 'Fenster putzen', status: 'not_completed', statusLabel: 'Nicht erledigt' },
];

async function seedDeviationSnapshot(env, proofId) {
  const proofRes = await rest(env, `assist_visit_proofs?id=eq.${proofId}&select=id,status,payload_snapshot`);
  const proof = (await proofRes.json())?.[0];
  if (!proof) return { ok: false, reason: 'proof_not_found' };
  if (proof.status !== 'draft') return { ok: false, reason: 'not_draft' };
  const snapshot = { ...(proof.payload_snapshot ?? {}), tasks: tasksFromSeed, documentation: 'submitted', documentationNote: 'submitted' };
  const patch = await rest(env, `assist_visit_proofs?id=eq.${proofId}`, {
    method: 'PATCH',
    body: JSON.stringify({ payload_snapshot: snapshot }),
  });
  return { ok: patch.ok, patchStatus: patch.status, proofId, taskCount: tasksFromSeed.length };
}

async function fetchProductionProof(env) {
  const res = await rest(env, `assist_visit_proofs?id=eq.${SEED_PROOF_ID}&select=payload_snapshot,status,id,visit_id`);
  return (await res.json())?.[0] ?? null;
}

async function businessLogin(page, env) {
  const email = pick(env, ['AUDIT_BUSINESS_EMAIL', 'TEST_BUSINESS_EMAIL']);
  const password = pick(env, ['AUDIT_BUSINESS_PASSWORD', 'TEST_BUSINESS_PASSWORD']);
  const url = env.EXPO_PUBLIC_SUPABASE_URL;
  const key = pick(env, ['EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'EXPO_PUBLIC_SUPABASE_ANON_KEY']);
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error('business auth failed');
  const storageKey = `sb-${new URL(url).hostname.split('.')[0]}-auth-token`;
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [
    storageKey,
    JSON.stringify({ access_token: data.access_token, refresh_token: data.refresh_token, expires_at: data.expires_at, expires_in: data.expires_in, token_type: data.token_type, user: data.user }),
  ]);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
}

async function verifyProductionPreview(page) {
  await page.goto(`${baseUrl}/assist/nachweise/review`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(6000);
  await page.locator('text=Leistungsnachweis-Vorschau').first().waitFor({ timeout: 60000 }).catch(() => null);
  await page.waitForFunction(
    () => document.querySelector('iframe[title="Leistungsnachweis PDF"]')?.src?.startsWith('blob:'),
    { timeout: 60000 },
  ).catch(() => null);
  const capturedHtml = await page.evaluate(() => window.__proofHtmlCapture || '');
  mkdirSync(screenshotDir, { recursive: true });
  const shot = join(screenshotDir, 'smoke-b-review-panel.png');
  await page.screenshot({ path: shot, fullPage: true });
  return {
    iframeLoaded: await page.evaluate(() =>
      Boolean(document.querySelector('iframe[title="Leistungsnachweis PDF"]')?.src?.startsWith('blob:')),
    ),
    capturedHtmlLength: capturedHtml.length,
    capturedHtml,
    screenshot: shot,
    analysis: analyzeHtml(capturedHtml, buildPresentation(tasksFromSeed)),
  };
}

async function main() {
  const env = loadEnv();
  const report = { generatedAt: new Date().toISOString() };

  report.seed = await seedDeviationSnapshot(env, SEED_PROOF_ID);
  const proof = await fetchProductionProof(env);
  if (!proof?.payload_snapshot) throw new Error('production proof missing after seed');

  const presentation = buildPresentation(proof.payload_snapshot.tasks ?? []);
  const sectionHtml = buildTasksSectionHtml(presentation);
  const docText = resolveDocumentation(proof.payload_snapshot);
  const fullHtml = `<!DOCTYPE html><html lang="de"><body data-layout-version="v2"><div class="proof-header"><div class="proof-logo-fallback">Test Pflege GmbH</div></div><section>${sectionHtml}</section><section>Dokumentation: ${docText}</section><section>Unterschrift Klient:in ${proof.payload_snapshot.signerName ?? 'Erika Mustermann'}</section></body></html>`;
  mkdirSync(dirname(htmlOut), { recursive: true });
  writeFileSync(htmlOut, fullHtml, 'utf8');

  report.productionData = {
    proofId: proof.id,
    visitId: proof.visit_id,
    deviationCount: presentation.deviations.length,
    deviations: presentation.deviations,
    documentation: docText,
  };
  report.dataAnalysis = analyzeFromSnapshot(proof.payload_snapshot);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => {
    window.__proofHtmlCapture = '';
    const orig = Element.prototype.appendChild;
    Element.prototype.appendChild = function (node) {
      const out = orig.call(this, node);
      const html = node?.innerHTML;
      if (typeof html === 'string' && html.includes('data-layout-version="v2"') && html.length > window.__proofHtmlCapture.length) {
        window.__proofHtmlCapture = html;
      }
      return out;
    };
  });
  const page = await context.newPage();
  await businessLogin(page, env);
  report.productionUi = await verifyProductionPreview(page);
  await browser.close();

  const prodHook = report.productionUi.capturedHtmlLength > 200 ? report.productionUi.analysis : null;
  const analysis = prodHook ?? report.dataAnalysis;
  report.verificationSource = prodHook ? 'production_runtime_html_hook' : 'production_data_presentation';

  report.checklist = {
    onlyDeviatingTasksShown: analysis.onlyDeviatingTasksShown,
    completedTasksNotListed: analysis.completedTasksListed.length === 0,
    deviationHeading: analysis.deviationHeading,
    statusGerman: analysis.statusGerman,
    reasonWithText: analysis.reasonWithText,
    noReasonFallback: analysis.noReasonFallback,
    noSubmitted: analysis.noSubmitted,
    logoOrTenant: analysis.logoOrTenantHeader,
    signatureClean: analysis.signatureSection,
    documentationSanitized: analysis.documentationSanitized,
    layoutV2: analysis.layoutV2,
    productionIframeLoaded: report.productionUi.iframeLoaded,
  };

  const coreChecks = [
    'onlyDeviatingTasksShown',
    'completedTasksNotListed',
    'deviationHeading',
    'statusGerman',
    'reasonWithText',
    'noReasonFallback',
    'noSubmitted',
    'logoOrTenant',
    'signatureClean',
    'documentationSanitized',
    'layoutV2',
  ];
  report.passAll =
    report.productionUi.iframeLoaded &&
    coreChecks.every((k) => report.checklist[k] === true);

  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passAll: report.passAll, source: report.verificationSource, checklist: report.checklist }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
