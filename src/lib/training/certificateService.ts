import type { RoleKey } from '@/types/core/auth';
import type { ServiceResult } from '@/types';
import type { EmployeeTrainingCertificate, VerifyCertificateInput } from '@/types/modules/training';
import { guardLiveDemoFeature } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { appendTrainingAuditEvent, TRAINING_STORE } from './trainingStore';
import { canVerifyCertificate } from './trainingAccessGuard';
import { isTrainingLiveReady } from './trainingModuleConfig';

export async function verifyEmployeeCertificate(
  input: VerifyCertificateInput,
  actorRole: RoleKey | null | undefined,
): Promise<ServiceResult<EmployeeTrainingCertificate>> {
  const blocked = guardLiveDemoFeature<EmployeeTrainingCertificate>(input.tenantId, 'Zertifikatsprüfung');
  if (blocked && getServiceMode() === 'supabase' && !isTrainingLiveReady()) return blocked;

  const access = canVerifyCertificate(actorRole);
  if (!access.allowed) return { ok: false, error: access.reason };

  const certificate = TRAINING_STORE.certificates.find((c) => c.id === input.certificateId);
  if (!certificate) return { ok: false, error: 'Zertifikat nicht gefunden.' };
  if (certificate.tenantId !== input.tenantId) {
    return { ok: false, error: 'Mandantentrennung verletzt.' };
  }

  const now = new Date().toISOString();
  const updated: EmployeeTrainingCertificate = {
    ...certificate,
    verificationStatus: input.verificationStatus,
    verifiedBy: input.actorId ?? null,
    verifiedAt: now,
    rejectionReason: input.rejectionReason ?? null,
    updatedAt: now,
  };

  const idx = TRAINING_STORE.certificates.findIndex((c) => c.id === certificate.id);
  TRAINING_STORE.certificates[idx] = updated;

  const record = TRAINING_STORE.records.find((r) => r.id === certificate.trainingRecordId);
  if (record && input.verificationStatus === 'verified') {
    const recordIdx = TRAINING_STORE.records.findIndex((r) => r.id === record.id);
    TRAINING_STORE.records[recordIdx] = {
      ...record,
      status: 'passed',
      passedAt: record.passedAt ?? now,
      verifiedBy: input.actorId ?? null,
      verifiedAt: now,
      updatedAt: now,
    };
  }

  appendTrainingAuditEvent({
    tenantId: input.tenantId,
    employeeId: certificate.employeeId,
    courseId: certificate.courseId,
    trainingRecordId: certificate.trainingRecordId,
    certificateId: certificate.id,
    action: `certificate_${input.verificationStatus}`,
    actorId: input.actorId ?? null,
    actorRole: input.actorRole ?? actorRole ?? null,
    summary: `Zertifikat ${input.verificationStatus}: ${certificate.title}`,
  });

  return { ok: true, data: updated };
}

export function isCertificateValidForDeployment(certificate: EmployeeTrainingCertificate, reference = new Date()): boolean {
  if (certificate.verificationStatus !== 'verified') return false;
  if (!certificate.validUntil) return true;
  return new Date(certificate.validUntil) >= reference;
}
