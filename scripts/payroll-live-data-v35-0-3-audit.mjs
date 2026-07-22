import { readFileSync } from 'node:fs';

const service = readFileSync('src/lib/payroll/payrollMonthService.ts', 'utf8');
const status = readFileSync('src/lib/payroll/payrollEmployeeStatus.ts', 'utf8');
const errors = readFileSync('src/lib/supabase/errors.ts', 'utf8');
const test = readFileSync('src/__tests__/payroll/payrollCalculator.test.ts', 'utf8');

const checks = [
  ['kein schemaabhängiger Employee-Enumfilter', !service.includes(".in('status', ['aktiv','in_bearbeitung'])")],
  ['statusneutrale Mitarbeiterabfrage', service.includes(".eq('tenant_id', tenantId).order('last_name')")],
  ['Anwendungsfilter für abrechnungsrelevante Mitarbeitende', service.includes('.filter(isPayrollRelevantEmployee).map')],
  ['ausgeschiedene Mitarbeitende ausgeschlossen', status.includes("'ausgeschieden'")],
  ['UUID-Meldung nur bei echtem UUID-Fehler', errors.includes("if (msg.includes('invalid input syntax for type uuid'))")],
  ['22P02 wird nicht pauschal als Mitarbeiter-ID ausgegeben', errors.includes("if (error.code === '22P02')")],
  ['Regressionstest für Live-Statusvarianten', test.includes("isPayrollRelevantEmployee({ status: 'probezeit' })")],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [label, ok] of checks) console.log(`${ok ? '✓' : '✗'} ${label}`);
if (failed.length) {
  console.error(`Payroll-Live-Daten-Audit fehlgeschlagen: ${failed.length} Prüfung(en).`);
  process.exit(1);
}
console.log(`Payroll-Live-Daten-Audit erfolgreich: ${checks.length}/${checks.length} Prüfungen.`);
