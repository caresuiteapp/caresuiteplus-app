import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');
const read = (relativePath: string) => readFileSync(path.join(root, relativePath), 'utf8');

describe('employee visit readability R10.3', () => {
  it('keeps every deviation explanation dark on the opaque white modal', () => {
    const modal = read('src/components/wfm/WfmVisitDeviationJustificationModal.tsx');
    expect(modal).toContain('testID="visit-deviation-readable-modal"');
    expect(modal).toContain('color: employeePortalExecutionText.primary');
    expect(modal).toContain('color: employeePortalExecutionText.secondary');
    expect(modal).not.toContain('color: text.secondary, ...typography');
    expect(modal).not.toContain('color: text.primary, ...typography');
  });

  it('makes photo and video visible before and during the visit start', () => {
    const screen = read('src/screens/portal/EmployeePortalVisitExecutionScreen.tsx');
    expect(screen).toContain('const renderAttachmentAction');
    expect(screen).toContain('testID="employee-visit-attachment-action"');
    expect(screen.match(/\{renderAttachmentAction\(\)\}/g)).toHaveLength(3);
  });

  it('keeps the deviation dialog usable with the mobile keyboard open', () => {
    const modal = read('src/components/wfm/WfmVisitDeviationJustificationModal.tsx');
    expect(modal).toContain('<KeyboardAvoidingView');
    expect(modal).toContain('keyboardShouldPersistTaps="handled"');
    expect(modal).toContain("maxHeight: '92%'");
  });

  it('uses the supplied medical robot once as optional help', () => {
    const assets = read('src/components/brand/brandassets.ts');
    const header = read('src/components/portal/EmployeePortalVisitStickyHeader.tsx');
    const progress = read('src/components/portal/EmployeePortalVisitProgressSteps.tsx');
    expect(assets).toContain('CARESUITE_VISIT_GUIDE_MASCOT');
    expect(assets).toContain('caresuite-visit-guide-robot.png');
    expect(header).toContain('source={CARESUITE_VISIT_GUIDE_MASCOT}');
    expect(progress).not.toContain('CARESUITE_VISIT_GUIDE_MASCOT');
    expect(header).toContain('visible={helpOpen}');
    expect(header).not.toContain('name="person"');
    expect(progress).not.toContain('name="person"');
  });
});
