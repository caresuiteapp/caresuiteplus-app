import type { RoleKey, ServiceResult } from '@/types';
import { assertTenantForMode } from '@/lib/tenant/tenantResolver';
import { qmDemoRepository } from './qmRepository.demo';
import { enforceQmPermission, QM_USE_AI, QM_VIEW } from './qmPermissions';
import type { QmAiDraft, QmAiDraftAction, QmTemplateSeed } from './qm.types';

const AI_SUGGESTIONS: Record<QmAiDraftAction, (ctx?: string) => string> = {
  create_chapter: () =>
    '## Vorgeschlagenes Kapitel\n\n### Einleitung\nQualitätsanforderungen gemäß SGB XI.\n\n### Verantwortlichkeiten\nQMB und PDL.\n\n### Prozessablauf\n1. Planung\n2. Durchführung\n3. Dokumentation',
  revise_document: (ctx) =>
    `## Überarbeitungsvorschlag\n\n${ctx ?? 'Dokument'}\n\n- Abschnitt „Verantwortlichkeit" präzisieren\n- MDK-Kriterien ergänzen\n- Review-Datum aktualisieren`,
  summarize: (ctx) =>
    `## Zusammenfassung\n\n${ctx ?? 'Dokument'}\n\nKernaussagen:\n- Qualitätssicherung ist dokumentiert\n- Verantwortlichkeiten sind definiert\n- Review-Zyklus: jährlich`,
  checklist: () =>
    '☐ Vorbereitung abgeschlossen\n☐ Unterlagen vollständig\n☐ Personal informiert\n☐ Räumlichkeiten geprüft\n☐ Nachverfolgung geplant',
  measure_plan: () =>
    '## Maßnahmenplan\n\n| Nr | Feststellung | Maßnahme | Frist | Verantwortlich |\n|----|--------------|----------|-------|----------------|\n| 1 | Dokumentation lückenhaft | VA überarbeiten | 14 Tage | QMB |\n| 2 | Schulung überfällig | Fortbildung planen | 30 Tage | PDL |',
  gap_analysis: () =>
    '## Lückenanalyse\n\n1. Fehlende Sturzprotokoll-Aktualisierung\n2. Datenschutz-Folgenabschätzung überfällig\n3. Hygiene-Schulung vor Audit empfohlen\n4. MD-Mappe unvollständig',
};

export async function fetchQmAiDrafts(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<QmAiDraft[]>> {
  const denied = enforceQmPermission<QmAiDraft[]>(actorRoleKey, QM_VIEW);
  if (denied) return denied;
  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return { ok: false, error: tenantErr.error };
  return qmDemoRepository.listAiDrafts(tenantId);
}

export async function createQmAiDraft(
  tenantId: string,
  input: {
    action: QmAiDraftAction;
    targetDocumentId?: string | null;
    targetChapterId?: string | null;
    promptSummary: string;
  },
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<QmAiDraft>> {
  const denied = enforceQmPermission<QmAiDraft>(actorRoleKey, QM_USE_AI);
  if (denied) return denied;
  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return { ok: false, error: tenantErr.error };

  await new Promise((r) => setTimeout(r, 300));

  const suggestedContent = AI_SUGGESTIONS[input.action](input.promptSummary);
  return qmDemoRepository.createAiDraft(tenantId, {
    action: input.action,
    targetDocumentId: input.targetDocumentId ?? null,
    targetChapterId: input.targetChapterId ?? null,
    promptSummary: input.promptSummary,
    suggestedContent,
  });
}

export async function acceptQmAiDraft(
  tenantId: string,
  draftId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<QmAiDraft>> {
  const denied = enforceQmPermission<QmAiDraft>(actorRoleKey, QM_USE_AI);
  if (denied) return denied;
  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return { ok: false, error: tenantErr.error };
  return qmDemoRepository.updateAiDraft(tenantId, draftId, 'accepted');
}

export async function rejectQmAiDraft(
  tenantId: string,
  draftId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<QmAiDraft>> {
  const denied = enforceQmPermission<QmAiDraft>(actorRoleKey, QM_USE_AI);
  if (denied) return denied;
  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return { ok: false, error: tenantErr.error };
  return qmDemoRepository.updateAiDraft(tenantId, draftId, 'rejected');
}

export async function fetchQmTemplates(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<QmTemplateSeed[]>> {
  const denied = enforceQmPermission<QmTemplateSeed[]>(actorRoleKey, QM_VIEW);
  if (denied) return denied;
  const tenantErr = assertTenantForMode(tenantId);
  if (tenantErr) return { ok: false, error: tenantErr.error };
  return qmDemoRepository.listTemplates(tenantId);
}
