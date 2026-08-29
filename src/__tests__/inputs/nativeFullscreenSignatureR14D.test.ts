import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../../..');
const read = (path: string) =>
  readFileSync(resolve(root, path), 'utf8').replace(/\r\n/g, '\n');

describe('R14-D native fullscreen signatures', () => {
  it('always uses fullscreen presentation in the installed app', () => {
    const modal = read('src/components/inputs/CareSignatureModal.tsx');
    const overlay = read('src/components/ui/FullscreenOverlay.tsx');
    expect(modal).toContain("forceFullscreen || Platform.OS !== 'web' || isPhone || isTablet");
    expect(modal).toContain('fillAvailable={fullscreen}');
    expect(overlay).toContain('presentationStyle="fullScreen"');
    expect(overlay).toContain('navigationBarTranslucent');
  });

  it('renders continuous native SVG paths instead of sparse point dots', () => {
    const canvas = read('src/components/inputs/CareSignatureCanvas.tsx');
    expect(canvas).toContain("import Svg, { Path } from 'react-native-svg'");
    expect(canvas).toContain('d={pointsToPath(stroke)}');
    expect(canvas).toContain('strokeLinecap="round"');
    expect(canvas).toContain('strokeLinejoin="round"');
    expect(canvas).not.toContain('const dotSize');
  });

  it('rescales captured ink after orientation or viewport changes', () => {
    const canvas = read('src/components/inputs/CareSignatureCanvas.tsx');
    expect(canvas).toContain('nativeSpaceRef');
    expect(canvas).toContain('scaleCanvasPoints(stroke, previousSpace, nextSpace)');
    expect(canvas).toContain('scaleCanvasPoints(\n          nativeCurrentRef.current');
  });

  it('does not discard the modal before persistence succeeds', () => {
    const modal = read('src/components/inputs/CareSignatureModal.tsx');
    const confirmBody = modal.slice(
      modal.indexOf('const handleConfirm'),
      modal.indexOf('const canvas ='),
    );
    expect(confirmBody).toContain('onConfirm(dataUrl)');
    expect(confirmBody).not.toContain('onClose()');

    const documentScreen = read('src/screens/documents/CsDocumentRequestDetailScreen.tsx');
    expect(documentScreen.indexOf('if (!result.ok)')).toBeLessThan(
      documentScreen.indexOf('setSignModal(false)', documentScreen.indexOf('if (!result.ok)')),
    );
  });

  it('moves the logbook day signature from an inline field into fullscreen', () => {
    const logbook = read('src/screens/portal/EmployeeLogbookScreen.tsx');
    expect(logbook).toContain("title={signature?'Unterschrift neu erfassen':'Unterschrift im Vollbild erfassen'}");
    expect(logbook).toContain('label="Fahrtenbuch-Tagesabschluss" forceFullscreen');
    expect(logbook).not.toContain('<CareSignatureCanvas');
  });
});
