export async function readNeoRecording(signal: AbortSignal): Promise<{ samples: Float32Array; rate: number } | null> {
  const file = await new Promise<File | null>((resolve, reject) => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'audio/*'; input.style.display = 'none'; document.body.append(input);
    const done = (value: File | null) => { signal.removeEventListener('abort', abort); input.remove(); resolve(value); };
    const abort = () => { input.remove(); reject(new DOMException('Abgebrochen', 'AbortError')); };
    input.onchange = () => done(input.files?.[0] ?? null); input.oncancel = () => done(null);
    signal.addEventListener('abort', abort, { once: true }); if (signal.aborted) { abort(); return; } input.click();
  });
  if (!file) return null; signal.throwIfAborted();
  if (file.size > 30 * 1024 * 1024) throw Error('Bitte eine Aufnahme bis 30 MB wählen.');
  const context = new AudioContext();
  try {
    const buffer = await context.decodeAudioData(await file.arrayBuffer()); signal.throwIfAborted();
    if (buffer.duration > 1800 || buffer.numberOfChannels < 1 || buffer.numberOfChannels > 2) throw Error('Bitte Aufnahmen bis 30 Minuten mit einer oder zwei Tonspuren wählen.');
    const samples = new Float32Array(buffer.length);
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) { const data = buffer.getChannelData(channel); for (let i = 0; i < samples.length; i++) samples[i] += data[i] / buffer.numberOfChannels; }
    return { samples, rate: buffer.sampleRate };
  } catch (error) { if (signal.aborted) throw error; throw Error(error instanceof Error && error.message.startsWith('Bitte') ? error.message : 'Dieses Audioformat konnte der Browser nicht lesen. Bitte WAV, MP3 oder M4A in einem unterstützten Browser verwenden.'); }
  finally { await context.close().catch(() => {}); }
}
