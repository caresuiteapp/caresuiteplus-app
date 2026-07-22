import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const requiredFiles = [
  'app/business/office/payroll/index.tsx',
  'app/portal/employee/payroll/index.tsx',
  'src/screens/office/PayrollMonthOverviewScreen.tsx',
  'src/screens/portal/EmployeePayrollMonthScreen.tsx',
  'src/lib/payroll/payrollCalculator.ts',
  'src/lib/payroll/payrollMonthService.ts',
  'src/types/modules/payrollMonth.ts',
  'supabase/migrations/0264_payroll_monthly_statement_and_expenses.sql',
];

const failures = [];
for (const relative of requiredFiles) {
  if (!fs.existsSync(path.join(root, relative))) failures.push(`Datei fehlt: ${relative}`);
}

function mustContain(relative, snippets) {
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute)) return;
  const source = fs.readFileSync(absolute, 'utf8');
  for (const snippet of snippets) {
    if (!source.includes(snippet)) failures.push(`${relative}: Pflichtmerkmal fehlt: ${snippet}`);
  }
}

mustContain('supabase/migrations/0264_payroll_monthly_statement_and_expenses.sql', [
  'employee_expense_claims',
  'payroll_month_statements',
  'payroll_month_audit_log',
  'employee_decide_payroll_statement',
  'ENABLE ROW LEVEL SECURITY',
  'konkreten Ablehnungsgrund mit mindestens 10 Zeichen',
  'Bestätigte oder gesperrte Abrechnungsversionen sind unveränderbar',
]);
mustContain('src/lib/payroll/payrollCalculator.ts', [
  'overtimeTransferMinutes',
  'projectedGrossCents',
  'approvedExpensesCents',
  'Geplante Einsätze bis Monatsende',
]);
mustContain('src/screens/portal/EmployeePayrollMonthScreen.tsx', [
  'Verbindlich bestätigen',
  'Ablehnungsgrund',
  'Quittung / Ticket auswählen',
  "category !== 'mileage' && !receipt",
]);
mustContain('src/screens/office/PayrollMonthOverviewScreen.tsx', [
  'PDF erstellen & veröffentlichen',
  'Neue Version veröffentlichen',
  'Genehmigen',
  'Rückfrage',
]);
mustContain('src/lib/navigation/modulenav/officenav.ts', ['Gehaltsstatistik']);
mustContain('src/lib/navigation/employeePortalNavigation.ts', ['Gehalt & Auslagen']);

if (failures.length) {
  console.error(`Payroll-Audit fehlgeschlagen (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Payroll-Audit erfolgreich: ${requiredFiles.length} Kerndateien und alle Schutzmerkmale geprüft.`);
