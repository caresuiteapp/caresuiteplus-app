import { readFileSync } from 'node:fs';
import process from 'node:process';
import { URL } from 'node:url';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const callers = [
  'src/lib/assist/visitDispositionExecutionEnrichment.ts',
  'src/lib/assist/resolveAssignmentExecutionSnapshot.ts',
  'src/lib/assist/visitRecurrenceExecution.ts',
  'src/lib/assist/visitService.ts',
  'src/lib/assist/assignmentDetailService.ts',
  'src/lib/assist/repositories/assignmentRepository.supabase.ts',
  'src/lib/assist/repositories/visitRepository.supabase.ts',
  'src/lib/portal/employeePortalAssignmentBridge.ts',
];

const utility = read('src/lib/assist/visitTransitionButtons.ts');
const checks = [
  ['Zyklusfreie Status-Button-Utility ist vorhanden', utility.includes('export function dedupeStatusTransitionButtons')],
  ['Alle produktiven Aufrufer verwenden die direkte Runtime-Utility', callers.every((file) =>
    read(file).includes("from '@/lib/assist/visitTransitionButtons'"))],
  ['Falscher Portal-Import aus assignmentStatusMachine ist entfernt',
    !read('src/lib/portal/employeePortalAssignmentBridge.ts').match(
      /dedupeStatusTransitionButtons[\s\S]{0,100}assignmentStatusMachine/,
    )],
  ['Bestehender visitWorkflow-Export bleibt kompatibel',
    read('src/lib/assist/visitWorkflow.ts').includes("export { dedupeStatusTransitionButtons } from '@/lib/assist/visitTransitionButtons'")],
];

console.log('CareSuite+ assist:visit-preview-runtime:v32.9.1:audit');
let failed = false;
for (const [label, ok] of checks) {
  console.log(`${ok ? '✓' : '✗'} ${label}`);
  if (!ok) failed = true;
}
if (failed) process.exitCode = 1;
