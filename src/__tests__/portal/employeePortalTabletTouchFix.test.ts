import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('employee portal tablet touch fixes', () => {
  it('tasks panel uses single PlatformModal for status picker instead of nested modals', () => {
    const panel = readSrc('src/components/portal/EmployeePortalVisitTasksPanel.tsx');
    expect(panel).toContain("title={statusPicker ? 'Aufgabenstatus' : 'Aufgaben'}");
    expect(panel).toContain('onBack={statusPicker ? closeStatusPicker : undefined}');
    expect(panel).toContain('{statusPicker ? statusPickerBody : body}');
    expect(panel).not.toMatch(/statusModal\s*=\s*statusPicker[\s\S]*<PlatformModal/);
    expect((panel.match(/<PlatformModal/g) ?? []).length).toBe(1);
  });

  it('tasks status options include web click handlers for tablet Safari', () => {
    const panel = readSrc('src/components/portal/EmployeePortalVisitTasksPanel.tsx');
    expect(panel).toContain('onClick: (event');
    expect(panel).toContain('stopPropagation');
  });

  it('signature canvas suppresses duplicate pointer/mouse input during touch drawing', () => {
    const canvas = readSrc('src/components/inputs/CareSignatureCanvas.tsx');
    expect(canvas).toContain('touchInputActiveRef');
    expect(canvas).toContain('touchInputActiveRef.current = true');
    expect(canvas).toContain('touchInputActiveRef.current = false');
    expect(canvas).toMatch(/handlePointerDown[\s\S]*touchInputActiveRef\.current/);
    expect(canvas).toMatch(/handleMouseDown[\s\S]*touchInputActiveRef\.current/);
  });

  it('signature canvas syncs coordinate space before drawing strokes', () => {
    const canvas = readSrc('src/components/inputs/CareSignatureCanvas.tsx');
    expect(canvas).toMatch(
      /const drawAt = useCallback\([\s\S]*syncCanvasToDisplay\(\)[\s\S]*drawSpaceRef\.current/,
    );
  });

  it('fullscreen overlay host is transparent until shell content renders', () => {
    const overlay = readSrc('src/components/ui/FullscreenOverlay.tsx');
    expect(overlay).toContain("host.style.backgroundColor = 'transparent'");
    expect(overlay).not.toMatch(
      /applyWebPortalHostStyles[\s\S]*host\.style\.backgroundColor = '#fff'/,
    );
  });

  it('visit execution screen clears leaked signature overlays on mount', () => {
    const screen = readSrc('src/screens/portal/EmployeePortalVisitExecutionScreen.tsx');
    expect(screen).toMatch(
      /useEffect\(\(\) => \{\s*releaseSignatureCaptureEnvironment\(\);\s*\}, \[\]\);/,
    );
  });
});
