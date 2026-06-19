import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { resolveEntityRoute, resolveModuleHomeRoute } from '@/ai/aiEntityRoutes';
import { AI_STATUS_LABELS } from '@/ai/aiToolTypes';

const root = resolve(__dirname, '../../..');

function readSource(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), 'utf8');
}

describe('VoiceCore AI foundation', () => {
  it('GlobalAiProvider wraps app shell above RootShell', () => {
    const layout = readSource('app/_layout.tsx');
    expect(layout).toContain('GlobalAiProvider');
    expect(layout.indexOf('GlobalAiProvider')).toBeLessThan(layout.indexOf('RootShell'));
  });

  it('registers all tools A-P in shared definitions', () => {
    const source = readSource('supabase/functions/_shared/aiToolDefinitions.ts');
    const required = [
      'search_caresuite',
      'get_current_page_context',
      'get_client_details',
      'get_employee_details',
      'get_client_tasks',
      'get_schedule_conflicts',
      'create_schedule_pending_action',
      'create_admission_protocol_pending_action',
      'search_documents',
      'open_document_preview',
      'summarize_client_case',
      'create_document_draft_pending_action',
      'create_care_note_pending_action',
      'navigate_to_module',
      'ask_missing_required_fields',
      'approve_pending_action',
    ];
    for (const name of required) {
      expect(source).toContain(`name: '${name}'`);
    }
  });

  it('admission protocol defines 24 sections', () => {
    const source = readSource('supabase/functions/_shared/aiTools.ts');
    expect(source).toContain('ADMISSION_PROTOCOL_SECTIONS');
    const matches = source.match(/'\d+\./g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(24);
  });

  it('entity routes map clients and appointments', () => {
    expect(resolveEntityRoute('client', 'abc-123')).toBe('/business/office/clients/abc-123');
    expect(resolveEntityRoute('client', 'abc-123', { tab: 'documents' })).toBe(
      '/business/office/clients/abc-123/documents',
    );
    expect(resolveEntityRoute('appointment', 'appt-1')).toBe('/office/appointments/appt-1');
    expect(resolveModuleHomeRoute('office')).toBe('/business/office');
  });

  it('status labels match German UX spec', () => {
    expect(AI_STATUS_LABELS.ready).toBe('Bereit');
    expect(AI_STATUS_LABELS.listening).toBe('Hört zu');
    expect(AI_STATUS_LABELS.thinking).toBe('Denkt');
    expect(AI_STATUS_LABELS.speaking).toBe('Antwortet');
    expect(AI_STATUS_LABELS.pending).toBe('Aktion vorbereitet');
    expect(AI_STATUS_LABELS.error).toBe('Fehler');
  });

  it('edge dispatch logs every tool call', () => {
    const source = readSource('supabase/functions/ai-action-dispatch/index.ts');
    expect(source).toContain("from('ai_action_logs').insert");
    expect(source).toContain('verifyAiTenantAccess');
  });

  it('text chat edge function exists with tenant guard', () => {
    const source = readSource('supabase/functions/ai-text-chat/index.ts');
    expect(source).toContain('verifyAiTenantAccess');
    expect(source).toContain('OPENAI_API_KEY');
  });

  it('commit function supports schedule, document, protocol and care note', () => {
    const source = readSource('supabase/functions/ai-commit-approved-action/index.ts');
    expect(source).toContain("case 'create_schedule_entry'");
    expect(source).toContain("case 'create_document_draft'");
    expect(source).toContain("case 'create_protocol'");
    expect(source).toContain("case 'create_care_note'");
  });

  it('page context hook is used on client record screen', () => {
    const source = readSource('src/screens/business/office/ClientRecordScreen.tsx');
    expect(source).toContain('useAiPageContext');
  });

  it('VoiceOrb includes CareSuite+ KI label and states', () => {
    const source = readSource('src/ai/VoiceOrbCore.tsx');
    expect(source).toContain('CareSuite+ KI');
    expect(source).toContain('isToolLoading');
    expect(source).toContain('hasPending');
  });

  it('VoiceOrb web entry avoids circular imports and uses bottom-left placement', () => {
    const web = readSource('src/ai/VoiceOrb.web.tsx');
    expect(web).not.toContain("from './VoiceOrb'");
    expect(web).toContain("from './VoiceOrbCore'");
    const core = readSource('src/ai/VoiceOrbCore.tsx');
    expect(core).toContain("position: 'fixed'");
    expect(core).toContain('useVoiceOrbPlacement()');
  });

  it('AiMiniPanel exposes text input fallback without debug context grid', () => {
    const source = readSource('src/ai/AiMiniPanel.tsx');
    expect(source).toContain('sendAiTextMessage');
    expect(source).toContain('Fortsetzen');
    expect(source).toContain('Entwurf prüfen');
    expect(source).not.toContain('contextGrid');
    expect(source).not.toContain("label: 'Seite'");
    expect(source).toContain('errorMessage');
  });

  it('GlobalAiProvider only tears down voice on unmount', () => {
    const source = readSource('src/ai/GlobalAiProvider.tsx');
    expect(source).toContain('teardownVoiceConnection');
    expect(source).not.toMatch(/useEffect\(\(\) => cleanupVoice/);
    expect(source).toContain('formatVoiceError');
  });
});

describe('VoiceCore navigation bridge', () => {
  it('dispatches caresuite:navigate custom event on web', () => {
    const source = readSource('src/ai/aiNavigationBridge.ts');
    expect(source).toContain('caresuite:navigate');
    expect(source).toContain('router.push');
  });
});
