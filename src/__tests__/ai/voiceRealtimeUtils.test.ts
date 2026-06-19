import { describe, expect, it, vi } from 'vitest';
import {
  exchangeRealtimeCallOffer,
  extractRealtimeClientSecret,
  formatVoiceErrorForPanel,
  getRealtimeCallsUrl,
  parseVoiceErrorMessage,
  truncateVoiceErrorMessage,
} from '@/ai/voiceRealtimeUtils';

describe('voiceRealtimeUtils', () => {
  it('extracts top-level realtime value', () => {
    expect(
      extractRealtimeClientSecret({
        session_id: 'sess-1',
        realtime: { value: 'ek_test_secret' },
      }),
    ).toBe('ek_test_secret');
  });

  it('extracts nested client_secret value', () => {
    expect(
      extractRealtimeClientSecret({
        session_id: 'sess-1',
        realtime: { client_secret: { value: 'ek_nested_secret' } },
      }),
    ).toBe('ek_nested_secret');
  });

  it('parses nested OpenAI JSON error payloads', () => {
    expect(
      parseVoiceErrorMessage(
        '{"error":{"message":"Invalid schema for function \'search_caresuite\'."}}',
      ),
    ).toBe("Invalid schema for function 'search_caresuite'.");
  });

  it('uses GA realtime calls endpoint without model query param', () => {
    expect(getRealtimeCallsUrl()).toBe('https://api.openai.com/v1/realtime/calls');
  });

  it('keeps specific WebRTC errors instead of generic fallback', () => {
    const longMessage = `WebRTC: ${'x'.repeat(300)}`;
    expect(formatVoiceErrorForPanel(new Error(longMessage), 'WebRTC')).toContain('WebRTC:');
    expect(formatVoiceErrorForPanel(new Error(longMessage), 'WebRTC').length).toBeLessThanOrEqual(221);
  });

  it('prefixes unknown errors with the failing step', () => {
    expect(formatVoiceErrorForPanel(new Error('SDP negotiation failed'), 'WebRTC')).toBe(
      'WebRTC: SDP negotiation failed',
    );
  });

  it('truncates long messages with ellipsis', () => {
    expect(truncateVoiceErrorMessage('a'.repeat(250)).endsWith('…')).toBe(true);
    expect(truncateVoiceErrorMessage('a'.repeat(250)).length).toBe(220);
  });

  it('exchangeRealtimeCallOffer throws parsed WebRTC errors', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => '{"error":{"message":"Invalid SDP offer"}}',
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(exchangeRealtimeCallOffer('ek_test', 'v=0')).rejects.toThrow(
      'WebRTC: Invalid SDP offer',
    );
  });
});
