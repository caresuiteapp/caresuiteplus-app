import type {
  PortalSignatureRequirement,
  PortalSignatureSignerRole,
} from '@/types/portal/documentSignatures';

export type PortalSignatureFieldMarker = {
  id: string;
  role: PortalSignatureSignerRole;
  label: string;
  order: number;
  required: boolean;
};

const EMPLOYEE_SIG_BLOCK = `<div class="cs-block-signature portal-signature-field" data-block="signature" data-signer-role="employee" data-signature-field-id="employee_signature" data-layout-area="signature_area">
<p><strong>Unterschrift Mitarbeiter</strong></p>
<p>{{signature.employee.name}}</p>
<p>Datum: {{signature.date}}</p>
</div>`;

const CLIENT_SIG_BLOCK = `<div class="cs-block-signature portal-signature-field" data-block="signature" data-signer-role="client" data-signature-field-id="client_signature" data-layout-area="signature_area">
<p><strong>Unterschrift Klient:in</strong></p>
<p>{{signature.client.name}}</p>
<p>Datum: {{signature.date}}</p>
</div>`;

export function buildEmployeeSignatureFieldBlock(): string {
  return EMPLOYEE_SIG_BLOCK;
}

export function buildClientSignatureFieldBlock(): string {
  return CLIENT_SIG_BLOCK;
}

export function insertSignatureFieldIntoHtml(
  html: string,
  role: PortalSignatureSignerRole,
): string {
  const block =
    role === 'employee' ? buildEmployeeSignatureFieldBlock() : buildClientSignatureFieldBlock();
  return `${html.trim()}\n${block}`;
}

/** Wrap fragment HTML for iframe preview (Schreiben / Vorlage). */
export function wrapSignatureDocumentPreviewHtml(bodyHtml: string): string {
  const body = bodyHtml.trim() || '<p>Keine Vorschau.</p>';
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: Arial, sans-serif; color: #111; padding: 16px; max-width: 800px; margin: 0 auto; line-height: 1.5; }
    .portal-signature-field, .cs-block-signature {
      border: 1px dashed #64748b; padding: 12px; margin-top: 16px; background: #f8fafc; border-radius: 8px;
    }
  </style>
</head>
<body>${body}</body>
</html>`;
}

export function parseSignatureFieldsFromHtml(html: string): PortalSignatureFieldMarker[] {
  if (!html.trim()) return [];

  const fields: PortalSignatureFieldMarker[] = [];
  let order = 0;

  const blockPattern =
    /data-signer-role="(employee|client)"[^>]*data-signature-field-id="([^"]+)"|data-signature-field-id="([^"]+)"[^>]*data-signer-role="(employee|client)"/gi;

  for (const match of html.matchAll(blockPattern)) {
    order += 1;
    const role = (match[1] ?? match[4]) as PortalSignatureSignerRole;
    const id = match[2] ?? match[3] ?? `${role}_${order}`;
    fields.push({
      id,
      role,
      label: role === 'employee' ? 'Mitarbeiter-Unterschrift' : 'Klient:innen-Unterschrift',
      order,
      required: true,
    });
  }

  if (fields.length === 0 && /\{\{signature\.employee\}\}/i.test(html)) {
    order += 1;
    fields.push({
      id: 'employee_signature',
      role: 'employee',
      label: 'Mitarbeiter-Unterschrift',
      order,
      required: true,
    });
  }
  if (fields.length === 0 && /\{\{signature\.client\}\}/i.test(html)) {
    order += 1;
    fields.push({
      id: 'client_signature',
      role: 'client',
      label: 'Klient:innen-Unterschrift',
      order,
      required: true,
    });
  }

  if (fields.length === 0 && /data-block="signature"/i.test(html)) {
    order += 1;
    fields.push({
      id: 'signature_default',
      role: 'employee',
      label: 'Unterschrift',
      order,
      required: true,
    });
  }

  return fields.sort((a, b) => a.order - b.order);
}

export function inferSignatureRequirementFromFields(
  fields: PortalSignatureFieldMarker[],
): PortalSignatureRequirement {
  const hasEmployee = fields.some((f) => f.role === 'employee');
  const hasClient = fields.some((f) => f.role === 'client');
  if (hasEmployee && hasClient) return 'both_sequential';
  if (hasClient) return 'client';
  return 'employee';
}

export function applyCapturedSignatureToHtml(
  html: string,
  fieldId: string,
  capture: { signerName: string; signedAt: string; imageUrl?: string | null },
): string {
  const signedBlock = capture.imageUrl
    ? `<img src="${capture.imageUrl}" alt="Unterschrift" style="max-width:240px;height:100px;object-fit:contain;" />`
    : `<span>${capture.signerName}</span>`;
  const replacement = `${signedBlock}<br/><small>${new Date(capture.signedAt).toLocaleString('de-DE')}</small>`;

  const fieldPattern = new RegExp(
    `(<div[^>]*data-signature-field-id="${fieldId}"[^>]*>)([\\s\\S]*?)(</div>)`,
    'i',
  );
  if (fieldPattern.test(html)) {
    return html.replace(fieldPattern, `$1${replacement}$3`);
  }

  return `${html}\n<p>Unterschrift (${fieldId}): ${replacement}</p>`;
}
