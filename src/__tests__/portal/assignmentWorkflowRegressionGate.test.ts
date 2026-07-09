import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ASSIGNMENT_WORKFLOW_CRITICAL_FILES,
  ASSIGNMENT_WORKFLOW_INVARIANTS,
  ASSIGNMENT_WORKFLOW_PHASES,
} from '@/lib/portal/assignmentWorkflowCriticalPath';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

function matchesPattern(source: string, pattern: string | RegExp): boolean {
  return typeof pattern === 'string' ? source.includes(pattern) : pattern.test(source);
}

describe('assignment workflow regression gate', () => {
  it('documents the full execution phases end-to-end', () => {
    expect(ASSIGNMENT_WORKFLOW_PHASES).toEqual([
      'consent',
      'travel',
      'arrive',
      'start_service',
      'tasks',
      'end_service',
      'documentation',
      'signature',
      'finalize',
    ]);
  });

  it.each(ASSIGNMENT_WORKFLOW_CRITICAL_FILES)('critical file exists: %s', (filePath) => {
    expect(existsSync(path.join(root, filePath))).toBe(true);
  });

  it.each(
    ASSIGNMENT_WORKFLOW_INVARIANTS.map((invariant) => [invariant.id, invariant] as const),
  )('invariant %s', (_id, invariant) => {
    for (const filePath of invariant.files) {
      const source = readSrc(filePath);
      if (invariant.matchAllFiles || invariant.files.length === 1) {
        expect(matchesPattern(source, invariant.mustContain)).toBe(true);
      }
      if (invariant.mustNotContain) {
        expect(matchesPattern(source, invariant.mustNotContain)).toBe(false);
      }
    }
    if (!invariant.matchAllFiles && invariant.files.length > 1) {
      const combined = invariant.files.map((f) => readSrc(f)).join('\n');
      expect(matchesPattern(combined, invariant.mustContain)).toBe(true);
    }
  });

  it('forbids nested PlatformModal stacks in visit documentation AI flow', () => {
    const panel = readSrc('src/components/portal/EmployeePortalVisitDocumentationPanel.tsx');
    const aiModal = readSrc('src/components/portal/EmployeePortalVisitDocumentationAiModal.tsx');
    expect(panel).toContain('PlatformModal');
    expect(aiModal).toContain('PlatformModal');
    expect(panel).not.toMatch(/<PlatformModal[\s\S]*<PlatformModal/);
  });

  it('keeps finalize and deferred-signature paths in execution hook', () => {
    const hook = readSrc('src/hooks/useEmployeePortalVisitExecution.ts');
    expect(hook).toContain('finalizeVisit');
    expect(hook).toContain('finalizeVisitDeferred');
    expect(hook).toContain('saveDocumentation');
    expect(hook).toContain('saveClientSignature');
    expect(hook).toContain('saveTask');
  });

  it('preserves post-service phase detection for documentation and signature', () => {
    const phase = readSrc('src/lib/portal/resolveVisitExecutionPhase.ts');
    const ui = readSrc('src/lib/portal/resolveVisitExecutionUiState.ts');
    expect(phase).toContain('post_service');
    expect(phase).toContain('showLiveBottomBar');
    expect(ui).toContain('showDocumentationForm');
    expect(ui).toContain('showSignature');
    expect(ui).toContain('showFinalize');
  });
});
