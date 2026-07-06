/**
 * Maps Dokumentenmodul ServiceProofRecord → zentrales Leistungsnachweis-Layout v2.
 * Read-only: verändert keine Quelldaten.
 */
import type { ServiceProofRecord } from '@/types/documents/serviceProof';
import { resolveVisitProofBranding, type VisitProofBrandingInput } from '@/lib/assist/visitProofBranding';
import {
  buildVisitProofLayoutHtml,
  type VisitProofSignatureBlock,
} from '@/lib/assist/visitProofPdfLayout';
import {
  buildVisitProofTasksPresentation,
  resolveVisitProofDocumentationText,
  type VisitProofTaskInput,
} from '@/lib/assist/visitProofTaskPresentation';
import { VISIT_PROOF_LAYOUT_VERSION } from '@/lib/assist/visitProofTaskPresentation';

export type ServiceProofTaskItem = VisitProofTaskInput;

export type ServiceProofLayoutInput = {
  proof: ServiceProofRecord;
  branding?: VisitProofBrandingInput;
  signatureImageUrl?: string | null;
  signerRole?: string | null;
};

function formatGermanDate(isoDate: string | null | undefined): string {
  if (!isoDate?.trim()) return '—';
  const trimmed = isoDate.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split('-');
    return `${d}.${m}.${y}`;
  }
  try {
    return new Date(trimmed).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return trimmed;
  }
}

function formatGermanDateTime(iso: string | null | undefined): string {
  if (!iso?.trim()) return '—';
  try {
    return new Date(iso).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatDurationMinutes(minutes: number | null | undefined): string {
  if (minutes == null || minutes <= 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}h ${m}min`;
  return `${m} min`;
}

function tryParseStructuredTasks(raw: unknown): VisitProofTaskInput[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry): VisitProofTaskInput | null => {
      if (!entry || typeof entry !== 'object') return null;
      const row = entry as Record<string, unknown>;
      const title = String(row.title ?? row.label ?? '').trim();
      if (!title) return null;
      return {
        id: row.id != null ? String(row.id) : undefined,
        title,
        status: row.status != null ? String(row.status) : null,
        statusLabel: row.statusLabel != null ? String(row.statusLabel) : null,
        note: row.note != null ? String(row.note) : null,
        reason: row.reason != null ? String(row.reason) : null,
        completionNote: row.completionNote != null ? String(row.completionNote) : null,
        notDoneReason: row.notDoneReason != null ? String(row.notDoneReason) : null,
        isInternal: row.isInternal === true || row.is_internal === true,
        isWorkflow: row.isWorkflow === true || row.is_workflow === true,
        category: row.category != null ? String(row.category) : null,
        type: row.type != null ? String(row.type) : null,
        moduleArea: row.moduleArea != null ? String(row.moduleArea) : null,
      };
    })
    .filter((item): item is VisitProofTaskInput => item != null);
}

/** Normalize ServiceProof task sources into structured task inputs. */
export function mapServiceProofTasks(proof: ServiceProofRecord): VisitProofTaskInput[] {
  if (proof.taskItems?.length) {
    return proof.taskItems.map((task) => ({ ...task }));
  }

  const parsedFromField = (() => {
    if (typeof proof.tasks !== 'string' || !proof.tasks.trim().startsWith('[')) return [];
    try {
      return tryParseStructuredTasks(JSON.parse(proof.tasks));
    } catch {
      return [];
    }
  })();
  if (parsedFromField.length) return parsedFromField;

  if (proof.proofType === 'monatsnachweis' && proof.deployments.length) {
    const fromDeployments: VisitProofTaskInput[] = [];
    for (const deployment of proof.deployments) {
      if (deployment.taskItems?.length) {
        fromDeployments.push(...deployment.taskItems.map((task) => ({ ...task })));
        continue;
      }
      const depParsed = (() => {
        if (typeof deployment.tasks !== 'string' || !deployment.tasks.trim().startsWith('[')) return [];
        try {
          return tryParseStructuredTasks(JSON.parse(deployment.tasks));
        } catch {
          return [];
        }
      })();
      if (depParsed.length) {
        fromDeployments.push(...depParsed);
      }
    }
    if (fromDeployments.length) return fromDeployments;
  }

  return [];
}

export function mapServiceProofDocumentToVisitProofLayoutInput(
  input: ServiceProofLayoutInput,
): Parameters<typeof buildVisitProofLayoutHtml>[0] {
  const { proof } = input;
  const tasks = mapServiceProofTasks(proof);
  const tasksPresentation = buildVisitProofTasksPresentation(tasks);

  const snapshot: Record<string, unknown> = {
    documentation: proof.documentation,
    documentationNote: proof.documentation,
    shortDescription: proof.shortDescription,
  };

  const documentation = resolveVisitProofDocumentationText(snapshot, proof.documentation);

  const branding = resolveVisitProofBranding(
    {
      logo_url: proof.logoUrl,
      tenantName: proof.companyName,
      companyName: proof.companyName,
    },
    input.branding ?? {
      logoUrl: proof.logoUrl,
      tenantName: proof.companyName,
      legalName: proof.companyName,
      addressLine: proof.footerText?.includes(',') ? proof.footerText : null,
      ikNumber: null,
      taxId: null,
    },
  );

  const plannedRange = `${formatGermanDate(proof.deploymentDate)} · ${proof.startTime} – ${proof.endTime}`;
  const serviceDate = formatGermanDate(proof.deploymentDate);

  const signatureMetaParts: string[] = [];
  if (proof.signatures.clientSigned) {
    signatureMetaParts.push(proof.clientName);
    if (proof.signatures.clientSignedAt) {
      signatureMetaParts.push(formatGermanDateTime(proof.signatures.clientSignedAt));
    }
    if (input.signerRole) signatureMetaParts.push(input.signerRole);
  }

  const signatureImageHtml = input.signatureImageUrl?.trim()
    ? `<img src="${input.signatureImageUrl.replace(/"/g, '&quot;')}" alt="Unterschrift" style="max-width:220px;max-height:72px;object-fit:contain;" />`
    : proof.signatures.clientSigned
      ? `<p style="margin:0;color:#6b7280;font-style:italic;font-size:12px;">Keine gezeichnete Unterschrift gespeichert.</p>`
      : '';

  const signature: VisitProofSignatureBlock = {
    imageHtml: signatureImageHtml,
    metaHtml: signatureMetaParts.length
      ? `<p class="proof-signature-meta">${signatureMetaParts.join(' · ').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`
      : '',
    emptyMessage: !proof.signatures.clientSigned ? 'Keine Signatur hinterlegt' : null,
  };

  if (proof.signatures.employeeSigned && proof.signatures.employeeSignedAt) {
    signature.metaHtml += `<p class="proof-signature-meta">Mitarbeitende:r ${proof.employeeName} · ${formatGermanDateTime(proof.signatures.employeeSignedAt)}</p>`;
  }

  return {
    title: `Leistungsnachweis — ${proof.serviceType}`,
    branding,
    meta: {
      proofNumber: proof.proofNumber ?? proof.id.slice(0, 8).toUpperCase(),
      generatedAt: formatGermanDateTime(proof.updatedAt ?? proof.createdAt),
      serviceDate,
      providerName: proof.companyName,
    },
    stammdaten: {
      clientName: proof.clientName,
      employeeName: proof.employeeName,
      serviceName: proof.serviceType,
      location: proof.shortDescription?.trim() || '—',
      costCarrier: proof.costBearer?.trim() || null,
    },
    times: {
      plannedRange,
      actualStart: proof.startTime || '—',
      actualEnd: proof.endTime || '—',
      serviceDuration: formatDurationMinutes(proof.durationMinutes),
      driveDuration: '—',
    },
    tasksPresentation,
    documentation,
    signature,
  };
}

/** Build complete layout-v2 HTML for Dokumentenmodul ServiceProof. */
export function buildServiceProofDocumentHtml(
  proof: ServiceProofRecord,
  options: Omit<ServiceProofLayoutInput, 'proof'> = {},
): string {
  const layoutInput = mapServiceProofDocumentToVisitProofLayoutInput({
    proof,
    signatureImageUrl: options.signatureImageUrl ?? proof.clientSignatureImageUrl,
    signerRole: options.signerRole ?? 'Klient:in',
    branding: options.branding,
  });
  const html = buildVisitProofLayoutHtml(layoutInput);
  if (!html.includes(`data-layout-version="${VISIT_PROOF_LAYOUT_VERSION}"`)) {
    return html.replace('<body', `<body data-layout-version="${VISIT_PROOF_LAYOUT_VERSION}"`);
  }
  return html;
}

export { VISIT_PROOF_LAYOUT_VERSION as SERVICE_PROOF_LAYOUT_VERSION };
