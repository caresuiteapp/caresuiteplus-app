type NativeSvgExporter = {
  toDataURL: (callback: (base64: string) => void, options?: object) => void;
};

/** Native SVG rendering exports the PNG accepted by signing and PDF services. */
export function exportNativeSignaturePng(
  svg: NativeSvgExporter | null,
  width: number,
  height: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const error = new Error('Die Unterschrift konnte nicht vorbereitet werden. Bitte erneut bestätigen.');
    if (!svg) { reject(error); return; }
    const timeout = setTimeout(() => reject(error), 8000);
    try {
      svg.toDataURL((base64) => {
        clearTimeout(timeout);
        if (!/^iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/.test(base64)) {
          reject(error);
          return;
        }
        resolve(`data:image/png;base64,${base64}`);
      }, { width, height });
    } catch {
      clearTimeout(timeout);
      reject(error);
    }
  });
}
