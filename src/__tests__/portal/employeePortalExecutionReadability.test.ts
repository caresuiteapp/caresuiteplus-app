import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  buildDocumentationAiSourceFromTasks,
  resolveDocumentationAiSourceText,
} from '@/lib/portal/buildDocumentationAiSourceText';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('employee portal execution readability', () => {
  const executionSurfaces = [
    'src/components/portal/EmployeePortalVisitStickyHeader.tsx',
    'src/components/portal/EmployeePortalVisitBottomBar.tsx',
    'src/components/portal/EmployeePortalVisitTasksPanel.tsx',
    'src/components/portal/EmployeePortalVisitLiveDashboard.tsx',
    'src/components/portal/EmployeePortalVisitCompactCard.tsx',
    'src/components/portal/EmployeePortalVisitDocumentationAiModal.tsx',
    'src/components/wfm/WfmVisitDeviationJustificationModal.tsx',
  ];

  it.each(executionSurfaces)('%s uses opaque execution surfaces instead of auroraGlass.elevated', (file) => {
    const src = readSrc(file);
    expect(src).toContain('employeePortalExecutionSurface');
    expect(src).toContain('employeePortalExecutionText');
    expect(src).not.toContain('auroraGlass.elevated');
    expect(src).not.toContain('useAuroraAdaptiveText');
  });

  it('signature modal uses plain white header on mobile instead of gradient glass', () => {
    const modal = readSrc('src/components/inputs/CareSignatureModal.tsx');
    expect(modal).toContain('PlainSignatureHeader');
    expect(modal).toContain('careLightColors.surface');
    expect(modal).not.toContain('GlassSurface');
  });

  it('signature canvas stacks bar actions and uses short confirm label', () => {
    const canvas = readSrc('src/components/inputs/CareSignatureCanvas.tsx');
    expect(canvas).toContain("title={actionLayout === 'bar' ? 'Bestätigen' : 'Unterschrift bestätigen'}");
    expect(canvas).toContain('flexDirection: \'column\'');
    expect(canvas).toContain('fullWidth={actionLayout === \'bar\'}');
  });

  it('documentation AI auto-falls back when cloud request fails', () => {
    const modal = readSrc('src/components/portal/EmployeePortalVisitDocumentationAiModal.tsx');
    expect(modal).toContain('applyLocalFallback()');
    expect(modal).toContain('Lokale Vorlage wurde erstellt');
  });

  it('execution screen seeds AI source from completed tasks', () => {
    const screen = readSrc('src/screens/portal/EmployeePortalVisitExecutionScreen.tsx');
    expect(screen).toContain('buildDocumentationAiSourceFromTasks');
    expect(screen).toContain('documentationAiSourceText');
  });

  it('buildDocumentationAiSourceFromTasks formats done tasks as bullets', () => {
    const source = buildDocumentationAiSourceFromTasks([
      { id: '1', title: 'Staubsaugen', status: 'done', required: false },
      { id: '2', title: 'Wäsche', status: 'open', required: false },
    ] as never);
    expect(source).toBe('- Staubsaugen');
    expect(resolveDocumentationAiSourceText('', undefined, source)).toBe('- Staubsaugen');
  });
});
