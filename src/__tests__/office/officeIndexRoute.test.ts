import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Office index route (H3 stack-level)', () => {
  it('app/office/index.tsx exists and exports OfficeIndexScreen', () => {
    const routePath = path.join(root, 'app/office/index.tsx');
    expect(existsSync(routePath)).toBe(true);
    const source = readSrc('app/office/index.tsx');
    expect(source).toContain('OfficeIndexScreen');
    expect(source).toContain('export default OfficeIndexScreen');
  });

  it('matches Assist stack-level index pattern', () => {
    const assist = readSrc('app/assist/index.tsx');
    const office = readSrc('app/office/index.tsx');
    expect(assist).toContain('export default AssistIndexScreen');
    expect(office).toContain('export default OfficeIndexScreen');
  });

  it('(tabs)/index still exports OfficeIndexScreen for tab slot', () => {
    const tabsIndex = readSrc('app/office/(tabs)/index.tsx');
    expect(tabsIndex).toContain('export default OfficeIndexScreen');
  });

  it('business/office/dashboard alias exports OfficeIndexScreen', () => {
    const alias = readSrc('app/business/office/dashboard.tsx');
    expect(alias).toContain('export default OfficeIndexScreen');
  });

  it('documents upload route stays separate from index', () => {
    const upload = readSrc('app/office/documents/upload.tsx');
    expect(upload).toContain('OfficeDocumentUploadScreen');
    expect(upload).not.toContain('OfficeIndexScreen');
  });

  it('OfficeIndexScreen renders HealthOS Office Command Center', () => {
    const screen = readSrc('src/screens/office/OfficeIndexScreen.tsx');
    expect(screen).toContain('HealthOSOfficeCommandCenterView');
    expect(screen).toContain('HealthOSModuleShell');
  });
});
