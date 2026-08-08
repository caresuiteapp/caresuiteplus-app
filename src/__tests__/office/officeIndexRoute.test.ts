import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Office index route (Liquid Command workspace)', () => {
  it('app/office/index.tsx exists and renders the complete workspace', () => {
    const routePath = path.join(root, 'app/office/index.tsx');
    expect(existsSync(routePath)).toBe(true);
    const source = readSrc('app/office/index.tsx');
    expect(source).toContain('ModuleWorkspaceScreen');
    expect(source).toContain('moduleKey="office"');
  });

  it('matches the Assist complete-workspace index pattern', () => {
    const assist = readSrc('app/assist/index.tsx');
    const office = readSrc('app/office/index.tsx');
    expect(assist).toContain('ModuleWorkspaceScreen');
    expect(office).toContain('ModuleWorkspaceScreen');
  });

  it('has no competing tab index for the same /office URL', () => {
    expect(existsSync(path.join(root, 'app/office/(tabs)/index.tsx'))).toBe(false);
    expect(existsSync(path.join(root, 'app/assist/(tabs)/index.tsx'))).toBe(false);
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

  it('the separate OfficeIndexScreen remains a valid HealthOS command-center component', () => {
    const screen = readSrc('src/screens/office/OfficeIndexScreen.tsx');
    expect(screen).toContain('HealthOSOfficeCommandCenterView');
    expect(screen).toContain('ScreenShell');
  });
});
