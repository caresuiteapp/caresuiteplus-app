import type { jsPDF, TextOptionsLight } from 'jspdf';
import { CENTURY_GOTHIC_REGULAR_BASE64 } from '@/design/fonts/centuryGothicData';

export const CARESUITE_PDF_FONT = 'CenturyGothic';

/** Only Regular was supplied. Bold uses the same face with PDF stroke emphasis. */
export function registerCareSuitePdfFont(pdf: jsPDF): void {
  pdf.addFileToVFS('CenturyGothic.ttf', CENTURY_GOTHIC_REGULAR_BASE64);
  pdf.addFont('CenturyGothic.ttf', CARESUITE_PDF_FONT, 'normal', 'Identity-H');
  pdf.addFont('CenturyGothic.ttf', CARESUITE_PDF_FONT, 'bold', 'Identity-H');
}

export function createCareSuitePdfText(pdf: jsPDF) {
  return (text: string | string[], x: number, y: number, options: TextOptionsLight = {}) => {
    if (pdf.getFont().fontStyle !== 'bold') return pdf.text(text, x, y, options);
    const width = pdf.getLineWidth();
    const color = pdf.getDrawColor();
    pdf.setDrawColor(pdf.getTextColor());
    pdf.setLineWidth(pdf.getFontSize() * 0.025 / pdf.internal.scaleFactor);
    try {
      return pdf.text(text, x, y, { ...options, renderingMode: 'fillThenStroke' });
    } finally {
      pdf.setLineWidth(width);
      pdf.setDrawColor(color);
    }
  };
}
