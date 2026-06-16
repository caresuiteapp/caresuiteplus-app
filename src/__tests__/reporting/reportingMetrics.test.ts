import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { KPI_DEFINITIONS, listAllKpiDefinitions } from '@/lib/reporting';
import { buildDemoReportingMetricsBundle } from '@/lib/reporting/reportingRepository.demo';
import { buildReportingDashboardSnapshot } from '@/lib/reporting/dashboardMetricsService';
import {
  canAccessReportingDashboard,
  filterKpiMetricsForRole,
  resolveReportingDashboardForRole,
} from '@/lib/reporting/metricAccessControl';
import { resolveReportingDateRange } from '@/lib/reporting/reportingDateRangeUtils';
import {
  fetchBillingReportingDashboard,
  fetchCeoDashboard,
  fetchReportingDashboard,
} from '@/lib/reporting/reportingService';
import { buildMetricAccessContext } from '@/lib/reporting/metricAccessControl';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';

const TENANT = DEMO_TENANT_ID;
const OTHER_TENANT = '00000000-0000-4000-8000-000000000099';

function ctx(roleKey: Parameters<typeof buildMetricAccessContext>[0]['roleKey']) {
  return buildMetricAccessContext({ tenantId: TENANT, roleKey, userId: 'u-1' });
}

describe('Prompt 70 — Reporting, Kennzahlen & Geschäftsführer-Dashboard', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('1. CEO-Dashboard trennt vorbereiteten Umsatz von fakturiertem Umsatz', async () => {
    const result = await fetchCeoDashboard(TENANT, 'business_admin');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const prepared = result.data.kpis.find((k) => k.kpiId === 'billing_revenue_prepared');
    const invoiced = result.data.kpis.find((k) => k.kpiId === 'billing_revenue_invoiced');
    expect(prepared).toBeDefined();
    expect(invoiced).toBeDefined();
    expect(prepared!.displayValue).not.toBe(invoiced!.displayValue);
    expect(prepared!.label).toContain('vorbereitet');
    expect(invoiced!.label).toContain('fakturiert');
  });

  it('2. Admin-Dashboard zeigt Einsätze und Dokumentation ohne vollständiges Billing', async () => {
    const result = await fetchReportingDashboard(TENANT, 'dispatch', { dashboardKind: 'admin' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.kind).toBe('admin');
    const ids = result.data.kpis.map((k) => k.kpiId);
    expect(ids).toContain('assignments_total');
    expect(ids).toContain('documentation_missing');
    expect(ids.some((id) => id.startsWith('billing_revenue'))).toBe(false);
  });

  it('3. Billing-Dashboard zeigt Abrechnungs-KPIs und markiert Entwürfe als vorbereitet wenn Tabelle fehlt', async () => {
    const result = await fetchBillingReportingDashboard(TENANT, 'billing');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const drafts = result.data.kpis.find((k) => k.kpiId === 'billing_drafts');
    expect(drafts?.availability).toBe('prepared');
    expect(drafts?.displayValue).toBe('Vorbereitet');
    const open = result.data.kpis.find((k) => k.kpiId === 'billing_open_amount');
    expect(open?.availability).toBe('active');
  });

  it('4. QM-Dashboard enthält Beschwerden, Notfälle und QM-Aufgaben', async () => {
    const result = await fetchReportingDashboard(TENANT, 'nurse', { dashboardKind: 'qm' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const ids = result.data.kpis.map((k) => k.kpiId);
    expect(ids).toContain('quality_complaints');
    expect(ids).toContain('quality_emergencies');
    expect(ids).toContain('quality_qm_tasks');
  });

  it('5. Mitarbeiter-Dashboard filtert Billing-KPIs heraus', async () => {
    const result = await fetchReportingDashboard(TENANT, 'employee_portal', { dashboardKind: 'employee' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.kpis.every((k) => k.category !== 'billing')).toBe(true);
  });

  it('6. Klient:innenportal erhält kein Executive-Dashboard', async () => {
    expect(resolveReportingDashboardForRole('client_portal')).toBeNull();
    const access = canAccessReportingDashboard(ctx('client_portal'), 'ceo');
    expect(access.allowed).toBe(false);

    const result = await fetchReportingDashboard(TENANT, 'client_portal');
    expect(result.ok).toBe(false);
  });

  it('7. Cross-Tenant-Zugriff wird blockiert', () => {
    const block = guardServiceTenant(OTHER_TENANT);
    expect(block?.ok).toBe(false);
  });

  it('8. Jede KPI-Definition hat eine definierte Datenquelle', () => {
    const defs = listAllKpiDefinitions();
    expect(defs.length).toBeGreaterThanOrEqual(30);
    for (const def of defs) {
      expect(def.dataSource).toBeTruthy();
      expect(def.id).toBeTruthy();
      expect(def.dashboards.length).toBeGreaterThan(0);
    }
  });

  it('9. Fehlende Tabellen erzeugen prepared-KPIs ohne Fake-Zahlen', () => {
    const range = resolveReportingDateRange('current_month');
    const bundle = buildDemoReportingMetricsBundle(TENANT, range);
    bundle.tableAvailability.invoice_drafts = false;
    bundle.tableAvailability.billable_items = false;

    const snapshot = buildReportingDashboardSnapshot(bundle, 'ceo', 'business_admin', true);
    const drafts = snapshot.kpis.find((k) => k.kpiId === 'billing_drafts');
    expect(drafts?.availability).toBe('prepared');
    expect(drafts?.value).toBeNull();
    expect(drafts?.displayValue).toBe('Vorbereitet');
  });

  it('10. Datumsfilter Heute/Woche/Monat liefern gültige Bereiche', () => {
    const ref = new Date('2026-06-15T12:00:00.000Z');
    const today = resolveReportingDateRange('today', undefined, undefined, ref);
    const week = resolveReportingDateRange('current_week', undefined, undefined, ref);
    const month = resolveReportingDateRange('current_month', undefined, undefined, ref);

    expect(new Date(today.from).getTime()).toBeLessThanOrEqual(new Date(today.to).getTime());
    expect(week.label).toContain('Woche');
    expect(month.label).toContain('Monat');
  });

  it('11. Unvollständige KPIs enthalten Grund und Datenqualitäts-Link', () => {
    const range = resolveReportingDateRange('current_month');
    const bundle = buildDemoReportingMetricsBundle(TENANT, range);
    bundle.tableAvailability.assignment_signatures = false;

    const snapshot = buildReportingDashboardSnapshot(bundle, 'admin', 'business_admin', true);
    const sig = snapshot.kpis.find((k) => k.kpiId === 'signatures_missing');
    expect(sig?.incompleteReason).toMatch(/Datenquelle/);
    expect(sig?.dataQualityRoute).toBeTruthy();
  });

  it('12. Rollenfilter entfernt nicht freigegebene Kennzahlen', () => {
    const range = resolveReportingDateRange('current_month');
    const bundle = buildDemoReportingMetricsBundle(TENANT, range);
    const snapshot = buildReportingDashboardSnapshot(bundle, 'ceo', 'business_admin', true);
    const billingFiltered = filterKpiMetricsForRole(snapshot.kpis, 'billing', 'billing');
    expect(billingFiltered.every((k) => ['billing', 'service_records', 'budget'].includes(k.category))).toBe(true);
  });

  it('13. Demo-KPIs sind aus verifizierbaren Demo-Quellen berechenbar', () => {
    const range = resolveReportingDateRange('current_month');
    const bundle = buildDemoReportingMetricsBundle(TENANT, range);
    expect(bundle.assignments.total).toBeGreaterThanOrEqual(0);
    expect(bundle.growth.revenuePreparedCents).toBeGreaterThanOrEqual(0);
    expect(bundle.growth.revenueInvoicedCents).toBeGreaterThanOrEqual(bundle.growth.revenuePreparedCents);

    const ceoKpis = KPI_DEFINITIONS.filter((k) => k.dashboards.includes('ceo'));
    expect(ceoKpis.length).toBeGreaterThan(10);
  });
});
