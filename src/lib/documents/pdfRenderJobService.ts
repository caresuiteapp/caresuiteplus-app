import type {
  DocumentRenderJob,
  DocumentRenderJobStatus,
  DocumentRenderJobType,
  PdfEngineInfo,
} from '@/types/documents/documentLifecycle';
import { isProduction } from '@/lib/environment';
import { PDF_ENGINE_INFO } from '@/types/documents/documentLifecycle';

export type PdfRenderJobInput = {
  tenantId: string;
  documentId: string;
  templateVersionId: string | null;
  htmlOutput: string;
  jobType?: DocumentRenderJobType;
  simulateFailure?: boolean;
};

export type PdfRenderJobResult =
  | {
      ok: true;
      job: DocumentRenderJob;
      pdfPath: string;
      isSimulated: boolean;
    }
  | { ok: false; job: DocumentRenderJob; error: string };

const JOBS = new Map<string, DocumentRenderJob>();
let jobCounter = 0;

export function getPdfEngineInfo(): PdfEngineInfo {
  return PDF_ENGINE_INFO;
}

export function isPdfProductionAvailable(tenantId?: string | null): boolean {
  return isProduction(tenantId) && PDF_ENGINE_INFO.productionAvailable;
}

/**
 * PDF-Render-Job — in Expo/RN kein natives PDF-Rendering.
 * Produktiv: Edge Function / Backend (Playwright/Puppeteer/wkhtmltopdf).
 * Demo: simuliert erfolgreichen Job mit Archiv-Pfad.
 */
export function executePdfRenderJob(input: PdfRenderJobInput): PdfRenderJobResult {
  jobCounter += 1;
  const id = `pdf-job-${jobCounter}`;
  const now = new Date().toISOString();
  const jobType = input.jobType ?? 'pdf';

  const baseJob: DocumentRenderJob = {
    id,
    tenantId: input.tenantId,
    documentId: input.documentId,
    templateVersionId: input.templateVersionId,
    jobType,
    jobStatus: 'processing',
    htmlOutput: input.htmlOutput,
    pdfPath: null,
    errorMessage: null,
    isProductionEngine: isPdfProductionAvailable(),
    startedAt: now,
    finishedAt: null,
    createdAt: now,
  };

  if (input.simulateFailure) {
    const failed: DocumentRenderJob = {
      ...baseJob,
      jobStatus: 'failed',
      errorMessage: 'PDF-Render-Job fehlgeschlagen (simuliert).',
      finishedAt: new Date().toISOString(),
    };
    JOBS.set(id, failed);
    return { ok: false, job: failed, error: failed.errorMessage! };
  }

  if (!isPdfProductionAvailable()) {
    const pdfPath = `archive/${input.tenantId}/${input.documentId}/${id}.pdf`;
    const completed: DocumentRenderJob = {
      ...baseJob,
      jobStatus: 'completed',
      pdfPath,
      finishedAt: new Date().toISOString(),
    };
    JOBS.set(id, completed);
    return { ok: true, job: completed, pdfPath, isSimulated: true };
  }

  const pdfPath = `archive/${input.tenantId}/${input.documentId}/${id}.pdf`;
  const completed: DocumentRenderJob = {
    ...baseJob,
    jobStatus: 'completed',
    pdfPath,
    isProductionEngine: true,
    finishedAt: new Date().toISOString(),
  };
  JOBS.set(id, completed);
  return { ok: true, job: completed, pdfPath, isSimulated: false };
}

export function getRenderJob(jobId: string): DocumentRenderJob | undefined {
  return JOBS.get(jobId);
}

export function resetPdfRenderJobs(): void {
  JOBS.clear();
  jobCounter = 0;
}

/** Edge-Function Payload-Vorbereitung (nicht produktiv aufrufen). */
export function buildEdgeFunctionPdfPayload(input: {
  tenantId: string;
  documentId: string;
  htmlOutput: string;
  options?: { pdfA?: boolean; embedLogo?: boolean };
}): Record<string, unknown> {
  return {
    action: 'render_pdf',
    tenant_id: input.tenantId,
    document_id: input.documentId,
    html: input.htmlOutput,
    format: 'A4',
    pdf_a: input.options?.pdfA ?? false,
    embed_logo: input.options?.embedLogo ?? true,
    repeat_header_footer: true,
    table_break: 'auto',
  };
}
