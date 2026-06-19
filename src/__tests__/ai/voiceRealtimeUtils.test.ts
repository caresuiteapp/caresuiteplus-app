import { describe, expect, it } from 'vitest';
import {
  extractRealtimeClientSecret,
  getRealtimeCallsUrl,
  parseVoiceErrorMessage,
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

  it('includes model query param for WebRTC calls', () => {
    expect(getRealtimeCallsUrl()).toContain('model=gpt-realtime');
  });
});
