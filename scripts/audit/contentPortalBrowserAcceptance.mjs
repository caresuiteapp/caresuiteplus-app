#!/usr/bin/env node
/**
 * Content Portal C.10 — browser acceptance helper (screenshots on E2E tenant only).
 * Requires valid AUDIT/TEST credentials in .env.
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const outPath = join(root, '.audit-content-portal-browser-acceptance-results.json');
const screenshotDir = join(root, 'docs', 'audit', 'content-portal-live-data-rebuild-screenshots');

const flows = [
  'office_dashboard_no_demo_leak',
  'client_record_portal_tab',
  'employee_record_portal_tab',
  'portal_approvals_inbox',
  'portal_sync_chain',
  'tenant_budget_edit',
  'tenant_service_catalog',
];

const result = {
  ok: false,
  phase: 'browser_acceptance_manual',
  screenshotDir,
  flows,
  note: 'Run Playwright/Cursor browser against E2E tenant a4ba83bd-… with valid credentials. No LIVE tenant screenshots with PII.',
  envRequired: [
    'EXPO_PUBLIC_SUPABASE_URL',
    'AUDIT_BUSINESS_EMAIL',
    'AUDIT_BUSINESS_PASSWORD',
  ],
};

writeFileSync(outPath, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
process.exit(0);
