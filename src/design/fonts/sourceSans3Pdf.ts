import type { jsPDF } from 'jspdf';
import { SOURCE_SANS_3_REGULAR_BASE64 } from './sourceSans3RegularData';
import { SOURCE_SANS_3_SEMIBOLD_BASE64 } from './sourceSans3SemiboldData';

export const SOURCE_SANS_3_PDF_FONT = 'SourceSans3';

export function registerSourceSans3PdfFont(pdf: jsPDF): void {
  pdf.addFileToVFS('SourceSans3-Regular.ttf', SOURCE_SANS_3_REGULAR_BASE64);
  pdf.addFont('SourceSans3-Regular.ttf', SOURCE_SANS_3_PDF_FONT, 'normal', 'Identity-H');
  pdf.addFileToVFS('SourceSans3-Semibold.ttf', SOURCE_SANS_3_SEMIBOLD_BASE64);
  pdf.addFont('SourceSans3-Semibold.ttf', SOURCE_SANS_3_PDF_FONT, 'bold', 'Identity-H');
}
