"""Historical renderer for recordings before Neo v6; use render-browser.mjs now.

Build CareSuite's fixed local reply recordings. Requires Piper 1.4.2 and FFmpeg.

This is a rendering tool for developers, never part of the app's runtime.
Usage: python generate_voice.py --model PATH --catalog PATH --output DIR
"""
import argparse
import base64
import hashlib
import json
import subprocess
import wave
from pathlib import Path

import numpy as np
import onnxruntime as ort
from piper import PiperVoice
from piper.config import PiperConfig, SynthesisConfig

# Rendering needs only the local model; do not send runtime telemetry.
ort.disable_telemetry_events()

MODEL_SHA256 = "9df1c43c61149ef9b39e618e2b861fbe41e1fcea9390b2dac62e8761573ea4f1"
CONFIG_SHA256 = "6de734444e4c3f9e33b7ebe2746dbc19b71e85f613e79c65acf623200b99a76a"


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    args = argparse.ArgumentParser()
    args.add_argument("--model", required=True, type=Path)
    args.add_argument("--catalog", required=True, type=Path)
    args.add_argument("--output", required=True, type=Path)
    a = args.parse_args()
    config_path = Path(str(a.model) + ".json")
    model_data = a.model.read_bytes() if a.model.exists() else b"".join(
        part.read_bytes() for part in sorted(a.model.parent.glob(a.model.name + ".part*")))
    assert hashlib.sha256(model_data).hexdigest() == MODEL_SHA256, "Unexpected voice model"
    assert sha(config_path) == CONFIG_SHA256, "Unexpected voice configuration"
    catalog = json.loads(a.catalog.read_text(encoding="utf-8"))
    a.output.mkdir(parents=True, exist_ok=True)
    session_options = ort.SessionOptions()
    session_options.intra_op_num_threads = 2
    session_options.inter_op_num_threads = 1
    ort.set_seed(29)
    voice = PiperVoice(
        config=PiperConfig.from_dict(json.loads(config_path.read_text())),
        session=ort.InferenceSession(model_data, sess_options=session_options,
                                    providers=["CPUExecutionProvider"]),
    )
    # Slightly slower pace, no pitch shifting or robot effects.
    tuning = SynthesisConfig(length_scale=1.18, noise_scale=0.60,
                             noise_w_scale=0.70, normalize_audio=True, volume=0.90)
    sample_rate = voice.config.sample_rate
    clips = {}
    reply_ids = {}
    report = []
    for reply_id, text in catalog.items():
        clip_id = hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]
        reply_ids[reply_id] = clip_id
        if clip_id in clips:
            continue
        wav = a.output / f"{clip_id}.wav"
        mp3 = a.output / f"{clip_id}.mp3"
        chunks = []
        for chunk in voice.synthesize(text, syn_config=tuning):
            if chunks:
                chunks.append(np.zeros(round(sample_rate * 0.16), dtype=np.int16))
            chunks.append(chunk.audio_int16_array)
        samples = np.concatenate(chunks)
        assert samples.size > sample_rate // 4, f"Empty audio: {text}"
        with wave.open(str(wav), "wb") as output:
            output.setnchannels(1)
            output.setsampwidth(2)
            output.setframerate(sample_rate)
            output.writeframes(samples.tobytes())
        subprocess.run([
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(wav),
            "-af", "loudnorm=I=-20:TP=-3:LRA=7", "-ar", str(sample_rate),
            "-ac", "1", "-codec:a", "libmp3lame", "-b:a", "80k", "-map_metadata", "-1", str(mp3),
        ], check=True)
        decoded = subprocess.check_output([
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-i", str(mp3),
            "-f", "f32le", "-acodec", "pcm_f32le", "-ac", "1", "-ar", str(sample_rate), "-",
        ])
        final = np.frombuffer(decoded, dtype=np.float32)
        peak = float(np.max(np.abs(final)))
        rms = float(np.sqrt(np.mean(final ** 2)))
        assert 0.02 < peak < 0.99, f"Silent/clipped audio: {text}"
        assert rms > 0.002, f"Silent audio: {text}"
        clips[clip_id] = base64.b64encode(mp3.read_bytes()).decode("ascii")
        report.append(dict(clipId=clip_id, text=text, duration=round(final.size/sample_rate, 3),
                           bytes=mp3.stat().st_size, peak=round(peak, 4),
                           rms=round(rms, 4), sha256=sha(mp3)))
        print(f"{len(clips):02d} {final.size/sample_rate:.1f}s {text}", flush=True)

    write_json = lambda name, value: (a.output/name).write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    write_json("voice-report.json", dict(modelSha256=MODEL_SHA256, sampleRate=sample_rate,
               piperVersion="1.4.2", lengthScale=1.18, noiseScale=0.60, noiseWScale=0.70,
               targetLoudnessLUFS=-20, replies=len(reply_ids), uniqueClips=len(clips), clips=report))
    write_json("reply-clips.json", reply_ids)
    bank = "/** Generated CareSuite audio. Source, license and recipe: robot-voice/VOICE.md. */\n"
    for name, value in [("ROBOT_AUDIO_TEXT", catalog), ("ROBOT_AUDIO_IDS", reply_ids), ("ROBOT_AUDIO_MP3", clips)]:
        bank += f"export const {name}: Readonly<Record<string, string>> = "
        bank += json.dumps(value, ensure_ascii=False, indent=2) + ";\n\n"
    (a.output / "robotAudioBank.web.ts").write_text(bank, encoding="utf-8")

    # The listening sample uses exactly the same encoded clips as the app.
    preview_keys = ["calendar:0", "waiting:0", "clientFound:0", "messages:2", "error:1"]
    preview = []
    for key in preview_keys:
        data = subprocess.check_output([
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-i",
            str(a.output / (reply_ids[key] + ".mp3")), "-f", "s16le", "-ar", str(sample_rate), "-ac", "1", "-",
        ])
        preview.extend([data, b"\x00\x00" * round(sample_rate * 0.65)])
    subprocess.run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "s16le",
        "-ar", str(sample_rate), "-ac", "1", "-i", "-", "-codec:a", "libmp3lame",
        "-b:a", "96k", str(a.output/"CareSuite_Stimme_Hoerprobe.mp3"),
    ], input=b"".join(preview), check=True)
    print(json.dumps(dict(replies=len(reply_ids), clips=len(clips),
                          bankBytes=(a.output/"robotAudioBank.web.ts").stat().st_size)), flush=True)


if __name__ == "__main__":
    main()
