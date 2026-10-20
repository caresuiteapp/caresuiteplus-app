import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('module assignment list LLGAN styling', () => {
  it('ModuleAssignedClientsScreen nutzt adaptive list cards statt dark legacy colors', () => {
    const source = readSrc('src/screens/modules/ModuleAssignedClientsScreen.tsx');
    expect(source).toContain('ModuleAssignmentListCard');
    expect(source).toContain('useAuroraAdaptiveText');
    expect(source).not.toContain('colors.bgElevated');
    expect(source).not.toContain('colors.textPrimary');
  });

  it('ModuleAssignmentListCard lokalisiert Workflow-Status', () => {
    const source = readSrc('src/components/office/ModuleAssignmentListCard.tsx');
    expect(source).toContain('resolveWorkflowStatusLabel');
    expect(source).toContain('resolveWorkflowStatusVariant');
    expect(source).toContain('PremiumCard');
  });

  it('OfficeModuleAssignmentListScreen nutzt FilterChipGroup und adaptive cards', () => {
    const source = readSrc('src/screens/business/office/OfficeModuleAssignmentListScreen.tsx');
    expect(source).toContain('FilterChipGroup');
    expect(source).toContain('ModuleAssignmentListCard');
    expect(source).not.toContain('colors.bgElevated');
  });

  it('AssignmentListCard erzwingt kein auroraGlass.card auf light shell', () => {
    const source = readSrc('src/components/assist/AssignmentListCard.tsx');
    expect(source).not.toContain('auroraGlass.card');
    expect(source).toContain('useAuroraAdaptiveText');
  });
});
