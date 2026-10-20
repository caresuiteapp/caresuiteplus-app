import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { dedupeStatusTransitionButtons } from '@/lib/assist/visitTransitionButtons';

const PRODUCT_CALLERS = [
  'src/lib/assist/visitDispositionExecutionEnrichment.ts',
  'src/lib/assist/resolveAssignmentExecutionSnapshot.ts',
  'src/lib/assist/visitRecurrenceExecution.ts',
  'src/lib/assist/visitService.ts',
  'src/lib/assist/assignmentDetailService.ts',
  'src/lib/assist/repositories/assignmentRepository.supabase.ts',
  'src/lib/assist/repositories/visitRepository.supabase.ts',
  'src/lib/portal/employeePortalAssignmentBridge.ts',
];

describe('Assist status transition buttons runtime regression', () => {
  it('exports a callable, deterministic dedupe helper', () => {
    expect(typeof dedupeStatusTransitionButtons).toBe('function');
    expect(
      dedupeStatusTransitionButtons(['bestaetigt', 'bestaetigt', 'unterwegs', 'storniert']),
    ).toEqual(['bestaetigt', 'unterwegs', 'storniert']);
  });

  it('uses the dependency-light runtime module in every productive caller', () => {
    for (const relativePath of PRODUCT_CALLERS) {
      const source = readFileSync(path.join(process.cwd(), relativePath), 'utf8');
      expect(source, relativePath).toContain(
        "dedupeStatusTransitionButtons } from '@/lib/assist/visitTransitionButtons'",
      );
      expect(source, relativePath).not.toMatch(
        /dedupeStatusTransitionButtons[\s\S]{0,100}from '@\/lib\/assist\/(visitWorkflow|assignmentStatusMachine)'/,
      );
    }
  });

  it('keeps the legacy workflow export compatible for existing imports and tests', async () => {
    const workflow = await import('@/lib/assist/visitWorkflow');
    expect(typeof workflow.dedupeStatusTransitionButtons).toBe('function');
  });
});
