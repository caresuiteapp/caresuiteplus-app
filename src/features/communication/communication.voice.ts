import type { RoleKey, ServiceResult } from '@/types';
import { runService } from '@/lib/services/serviceRunner';
import { appendCommunicationAudit } from './communication.audit';
import { uploadAttachment } from './communication.attachments';
import { enforceCommunicationPermission } from './communication.permissions';
import { VOICE_STORAGE_PATH } from './communication.constants';
import type { CommunicationAttachment } from './communication.types';

type VoiceRecordingState = {
  isRecording: boolean;
  startedAt: number | null;
  durationSeconds: number;
};

let recordingState: VoiceRecordingState = {
  isRecording: false,
  startedAt: null,
  durationSeconds: 0,
};

export function startVoiceRecordingPrepared(): ServiceResult<{ started: true }> {
  recordingState = { isRecording: true, startedAt: Date.now(), durationSeconds: 0 };
  return { ok: true, data: { started: true } };
}

export function stopVoiceRecordingPrepared(): ServiceResult<{ durationSeconds: number }> {
  if (!recordingState.isRecording || !recordingState.startedAt) {
    return { ok: false, error: 'Keine aktive Aufnahme.' };
  }
  const durationSeconds = Math.max(1, Math.round((Date.now() - recordingState.startedAt) / 1000));
  recordingState = { isRecording: false, startedAt: null, durationSeconds };
  return { ok: true, data: { durationSeconds } };
}

export function cancelVoiceRecording(): ServiceResult<{ cancelled: true }> {
  recordingState = { isRecording: false, startedAt: null, durationSeconds: 0 };
  return { ok: true, data: { cancelled: true } };
}

export function getVoiceRecordingState(): VoiceRecordingState {
  return recordingState;
}

export async function uploadVoiceMessage(
  tenantId: string,
  threadId: string,
  messageId: string,
  durationSeconds: number,
  actorRoleKey?: RoleKey | null,
  uploadedBy?: string | null,
): Promise<ServiceResult<CommunicationAttachment>> {
  const denied = enforceCommunicationPermission<CommunicationAttachment>(
    actorRoleKey,
    'communication.send_voice_message',
  );
  if (denied) return denied;

  return runService(async () => {
    const storagePath = VOICE_STORAGE_PATH.replace('{tenantId}', tenantId)
      .replace('{threadId}', threadId)
      .replace('{messageId}', messageId);

    const result = await uploadAttachment(
      {
        tenantId,
        threadId,
        messageId,
        filename: `${messageId}.m4a`,
        mimeType: 'audio/m4a',
        sizeBytes: durationSeconds * 4000,
        attachmentType: 'voice',
        uploadedBy,
      },
      actorRoleKey,
    );

    if (!result.ok) return result;
    result.data.durationSeconds = durationSeconds;
    result.data.waveformPreview = generateWaveformPreviewPrepared(durationSeconds);
    result.data.storagePath = storagePath;

    appendCommunicationAudit({
      tenantId,
      userId: uploadedBy ?? null,
      action: 'voice_sent',
      entityType: 'communication_attachment',
      entityId: result.data.id,
      threadId,
      messageId,
      result: 'success',
      metadata: { durationSeconds },
    });

    return result;
  });
}

export function getVoicePlaybackUrl(attachment: CommunicationAttachment): string | null {
  return attachment.publicUrl ?? attachment.storagePath;
}

export function getVoiceDuration(attachment: CommunicationAttachment): number {
  return attachment.durationSeconds ?? 0;
}

export function generateWaveformPreviewPrepared(durationSeconds: number): number[] {
  const bars = Math.min(20, Math.max(5, durationSeconds));
  return Array.from({ length: bars }, (_, i) => 0.2 + ((i * 17) % 10) / 10);
}
