import type { RoleKey, ServiceResult } from '@/types';
import type { PermissionKey } from '@/types/permissions';
import { appendDomainMessage } from '@/data/demo/portalMessageStore';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { enforcePermission } from '@/lib/permissions';
import { runService } from '@/lib/services/serviceRunner';

export type DomainMessageInput = {
  wpNumber: number;
  domain: string;
  tenantId: string;
  actorRoleKey: RoleKey | null | undefined;
  permission: PermissionKey;
  audienceScope: 'office' | 'portal';
  subject: string;
  body: string;
  senderName?: string;
  recipientName?: string;
};

export type DomainMessageResult = {
  id: string;
  subject: string;
  body: string;
};

export async function sendDomainMessage(
  input: DomainMessageInput,
): Promise<ServiceResult<DomainMessageResult>> {
  const denied = enforcePermission<DomainMessageResult>(input.actorRoleKey, input.permission);
  if (denied) return denied;

  return runService(async () => {
    if (input.tenantId !== DEMO_TENANT_ID) {
      return { ok: false, error: 'Mandant nicht gefunden.' };
    }

    const subject = input.subject.trim();
    const body = input.body.trim();

    if (!subject) {
      return { ok: false, error: 'Betreff erforderlich.' };
    }
    if (body.length < 10) {
      return { ok: false, error: 'Nachricht muss mindestens 10 Zeichen haben.' };
    }

    await new Promise((r) => setTimeout(r, 180));

    const saved = appendDomainMessage({
      tenantId: input.tenantId,
      domain: input.domain,
      wpNumber: input.wpNumber,
      audienceScope: input.audienceScope,
      subject,
      body,
      senderName: input.senderName ?? 'CareSuite Demo',
      recipientName: input.recipientName ?? 'Empfänger',
    });

    return {
      ok: true,
      data: { id: saved.id, subject: saved.subject, body: saved.body },
    };
  });
}
