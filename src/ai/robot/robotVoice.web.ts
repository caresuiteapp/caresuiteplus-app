import { ROBOT_AUDIO_IDS, ROBOT_AUDIO_MP3 } from './robotAudioBank.web';

const cache = new Map<string, ArrayBuffer>();

/** Fixed bundled recordings: no TTS request, browser voice or network access. */
export async function loadLocalRobotVoice(replyId: string, signal: AbortSignal): Promise<ArrayBuffer> {
  signal.throwIfAborted();
  const clipId = Object.prototype.hasOwnProperty.call(ROBOT_AUDIO_IDS, replyId) ? ROBOT_AUDIO_IDS[replyId] : undefined;
  if (!clipId) throw new Error('robot-voice-unknown-reply');
  let audio = cache.get(clipId);
  if (!audio) {
    const encoded = ROBOT_AUDIO_MP3[clipId];
    if (!encoded) throw new Error('robot-voice-missing-recording');
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    audio = bytes.buffer;
    cache.set(clipId, audio);
  }
  signal.throwIfAborted();
  // decodeAudioData may detach its input. Never expose the cached buffer itself.
  return audio.slice(0);
}
