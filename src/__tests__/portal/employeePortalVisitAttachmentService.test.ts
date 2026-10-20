import { describe, expect, it } from 'vitest';
import { buildAssistVisitAttachmentStoragePath } from '@/lib/assist/assistStoragePaths';

describe('buildAssistVisitAttachmentStoragePath', () => {
  it('builds tenant-scoped assist visit attachment path', () => {
    const path = buildAssistVisitAttachmentStoragePath('tenant-1', 'visit-1', 'att-1', 'foto.jpg');
    expect(path).toBe('tenant/tenant-1/assist/visits/visit-1/attachments/att-1.jpg');
  });
});
