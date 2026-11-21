// Audio stays in this explicitly started capture; the main thread applies VAD and bounded WAV encoding.
class NeoCaptureProcessor extends AudioWorkletProcessor {
  constructor() { super(); this.frames = []; this.length = 0; this.stopped = false;
    this.port.onmessage = ({ data }) => {
      if (data === 'flush') { this.emitFrames(); this.port.postMessage({ flushed: true }); }
      if (data === 'stop') { this.stopped = true; this.frames = []; this.length = 0; }
    };
  }
  emitFrames() {
    if (!this.length) return;
    const samples = new Float32Array(this.length); let offset = 0;
    for (const part of this.frames) { samples.set(part, offset); offset += part.length; }
    this.port.postMessage(samples, [samples.buffer]); this.frames = []; this.length = 0;
  }
  process(inputs) {
    if (this.stopped) return false;
    const channel = inputs[0]?.[0]; if (!channel?.length) return true;
    this.frames.push(channel.slice()); this.length += channel.length;
    if (this.length >= sampleRate / 4) {
      this.emitFrames();
    }
    return true;
  }
}
registerProcessor('neo-capture', NeoCaptureProcessor);
