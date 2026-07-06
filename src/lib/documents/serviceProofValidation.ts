import type { ServiceProofRecord } from '@/types/documents/serviceProof';
import type { TemplateValidationIssue, TemplateValidationResult } from '@/features/documents/templateEngine/types';

/** Berechnet Minuten aus HH:MM-Zeitstrings */
export function parseTimeToMinutes(time: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) return null;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function computeDurationMinutes(startTime: string, endTime: string): number {
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  if (start === null || end === null || end <= start) return 0;
  return end - start;
}

export function sumDeploymentHours(deployments: ServiceProofRecord['deployments']): number {
  const totalMinutes = deployments.reduce((sum, d) => sum + d.durationMinutes, 0);
  return Math.round((totalMinutes / 60) * 100) / 100;
}

export function validateServiceProofRecord(proof: ServiceProofRecord): TemplateValidationResult {
  const issues: TemplateValidationIssue[] = [];

  if (!proof.clientName?.trim()) {
    issues.push({
      code: 'client_missing',
      message: 'Klient:in fehlt.',
      fieldKey: 'client.full_name',
      severity: 'error',
    });
  }

  if (proof.proofType === 'einzel_einsatznachweis') {
    if (!proof.deploymentDate?.trim()) {
      issues.push({
        code: 'deployment_date_missing',
        message: 'Einsatzdatum fehlt.',
        fieldKey: 'visit.date',
        severity: 'error',
      });
    }
    if (!proof.startTime?.trim() || !proof.endTime?.trim()) {
      issues.push({
        code: 'times_missing',
        message: 'Start- oder Endzeit fehlt.',
        fieldKey: 'visit.start_time',
        severity: 'error',
      });
    } else if (proof.durationMinutes <= 0) {
      issues.push({
        code: 'duration_invalid',
        message: 'Dauer ungültig — Endzeit muss nach Startzeit liegen.',
        fieldKey: 'visit.duration',
        severity: 'error',
      });
    }
  }

  if (proof.proofType === 'monatsnachweis') {
    if (proof.deployments.length === 0) {
      issues.push({
        code: 'deployments_missing',
        message: 'Monatsnachweis ohne Einsätze.',
        fieldKey: 'visit.deployments',
        severity: 'error',
      });
    }
    for (const dep of proof.deployments) {
      if (!dep.startTime?.trim() || !dep.endTime?.trim()) {
        issues.push({
          code: 'deployment_times_missing',
          message: `Einsatz ${dep.id}: Start- oder Endzeit fehlt.`,
          fieldKey: 'visit.start_time',
          severity: 'error',
        });
      }
    }
  }

  if (!proof.employeeName?.trim()) {
    issues.push({
      code: 'employee_missing',
      message: 'Mitarbeitende:r fehlt.',
      fieldKey: 'visit.employee_name',
      severity: 'error',
    });
  }

  if (!proof.previewConfirmed) {
    issues.push({
      code: 'preview_required',
      message: 'Vorschau muss bestätigt sein.',
      severity: 'error',
    });
  }

  return {
    status: issues.some((i) => i.severity === 'error') ? 'error' : 'valid',
    issues,
  };
}

export function validateServiceProofForSignature(proof: ServiceProofRecord): TemplateValidationResult {
  const base = validateServiceProofRecord(proof);
  const issues = [...base.issues];

  if (!proof.signatures.clientSigned) {
    issues.push({
      code: 'client_signature_missing',
      message: 'Klientenunterschrift fehlt.',
      fieldKey: 'signature.client',
      severity: 'error',
    });
  }

  return {
    status: issues.some((i) => i.severity === 'error') ? 'error' : 'valid',
    issues,
  };
}

export function serviceProofToDocumentContext(proof: ServiceProofRecord) {
  const formatHours = (h: number) => h.toFixed(2).replace('.', ',');
  return {
    company: { name: proof.companyName },
    client: {
      full_name: proof.clientName,
      care_level: proof.careLevel,
    },
    cost_carrier: { name: proof.costBearer },
    visit: {
      date: proof.deploymentDate,
      start_time: proof.startTime,
      end_time: proof.endTime,
      duration: `${proof.durationMinutes} Min.`,
      duration_minutes: String(proof.durationMinutes),
      service_type: proof.serviceType,
      employee_name: proof.employeeName,
      documentation: proof.documentation,
      budget_reference: proof.budgetAllocation,
      tasks: proof.tasks,
      short_description: proof.shortDescription,
      total_hours: formatHours(proof.totalHours),
      billing_amount: (proof.billingAmountCents / 100).toFixed(2),
      service_month: proof.serviceMonth,
      deployments_count: String(proof.deployments.length),
    },
    signature: {
      client: proof.signatures.clientSigned ? 'Unterschrieben' : '',
      employee: proof.signatures.employeeSigned ? 'Unterschrieben' : '',
    },
    document: {
      number: proof.proofNumber ?? '',
      footer: proof.footerText,
    },
  };
}

export const STANDARD_SERVICE_PROOF_HTML_TEMPLATE = `<div class="cs-service-proof" data-doc-type="service_record">
<div class="cs-block-logo">{{company.name}}</div>
<h1>Leistungsnachweis {{document.number}}</h1>
<p>Leistungsmonat: {{visit.service_month}} · Klient:in: {{client.full_name}} · PG: {{client.care_level}}</p>
<p>Kostenträger: {{cost_carrier.name}} · Mitarbeitende:r: {{visit.employee_name}}</p>
<p>Datum: {{visit.date}} · {{visit.start_time}} – {{visit.end_time}} ({{visit.duration}})</p>
<p>Leistungsart: {{visit.service_type}}</p>
<p>Aufgaben: {{visit.tasks}}</p>
<p>{{visit.short_description}}</p>
<p>Dokumentation: {{visit.documentation}}</p>
<p>Gesamtstunden: {{visit.total_hours}} · Betrag: {{visit.billing_amount}} €</p>
<p>Budget: {{visit.budget_reference}}</p>
<p>Einsätze (Monat): {{visit.deployments_count}}</p>
<section class="cs-signatures">
<p>Klient:in: {{signature.client}}</p>
<p>Mitarbeitende:r: {{signature.employee}}</p>
</section>
<div class="cs-block-footer">{{document.footer}}</div>
</div>`;

export function getServiceProofTemplateVersionId(proofType: ServiceProofRecord['proofType']): string {
  return `dtplv-service-proof-${proofType}`;
}

/** @deprecated Layout v2 — nutze buildServiceProofDocumentHtml() aus serviceProofLayoutAdapter. */
export const FINALIZE_SERVICE_PROOF_HTML_TEMPLATE = '';

export function renderDeploymentsTableHtml(deployments: ServiceProofRecord['deployments']): string {
  return deployments
    .map(
      (d) =>
        `<tr><td>${d.deploymentDate}</td><td>${d.startTime}</td><td>${d.endTime}</td><td>${d.durationMinutes}</td><td>${d.serviceType}</td></tr>`,
    )
    .join('');
}
