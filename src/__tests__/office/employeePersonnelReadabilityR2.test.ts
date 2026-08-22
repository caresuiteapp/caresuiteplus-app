import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');
const read = (relativePath: string) => readFileSync(path.join(root, relativePath), 'utf8');

describe('Personalbereich Lesbarkeit und Popup-Größe R2', () => {
  it('grenzt helle Personalflächen gegen den dunklen Central-Popup-Vertrag ab', () => {
    const surface = read('src/components/office/PersonalWorkspaceSurface.tsx');
    const contract = read('src/design/web/centralHealthOSPopupContractCss.ts');
    const list = read('src/screens/office/EmployeesListScreen.tsx');

    expect(surface).toContain("csPersonalSurface: 'light'");
    expect(surface).toContain('SurfaceContrastProvider tone="light"');
    expect(contract).toContain('[data-cs-personal-surface="light"]');
    expect(contract).toContain('--personal-ink: #0B213D');
    expect(contract).toContain('background-color: #FFFFFF !important');
    expect(contract).toContain('[data-cs-healthos-component="list-row"]');
    expect(contract).toContain('color: var(--personal-muted) !important');
    expect(list).toContain('PersonalWorkspaceSurface');
  });

  it('wendet den Light-Kontext auch auf imperative Web-Glasflächen an', () => {
    const glass = read('src/design/web/applyLlganGlassDom.tsx');

    expect(glass).toContain("surfaceTone === 'light'");
    expect(glass).toContain('const lightSurface = portalActive || forceLight');
  });

  it('vergrößert sämtliche Personal-Desktop-Popups deutlich', () => {
    const create = read('src/components/office/employeecreatemodal.tsx');
    const detail = read('src/components/office/employeedetailmodal.tsx');
    const offboarding = read('src/components/office/employeeoffboardingmodal.tsx');
    const sectionEdit = read('src/components/office/EmployeeSectionEditModal.tsx');

    expect(create).toContain('MODAL_MAX_WIDTH = 1180');
    expect(detail).toContain('PREVIEW_MAX_WIDTH = 1280');
    expect(detail).toContain('FULL_MAX_WIDTH = 1640');
    expect(offboarding).toContain('MODAL_MAX_WIDTH = 1440');
    expect(sectionEdit).toContain('maxWidth={1120}');
    expect(sectionEdit).toContain('surfaceScope="personal"');
  });
});
