# Neo – lokale Sprachkomponenten

Die Dateien in diesem Verzeichnis und ihre übergeordneten Laufzeitdateien gehören zur lokalen Browser-Sprachausgabe. Namens- und Antworttexte werden ausschließlich im Browser verarbeitet. Der Sprachworker wird zusammen mit CareSuite bereitgestellt; er kontaktiert keine TTS-Anbieter.

## Komponenten

- **ONNX Runtime Web 1.18.0**, Microsoft und Mitwirkende: MIT. Originalpaket `onnxruntime-web@1.18.0`, unveränderte Dateien `ort.wasm.min.js`, `ort-wasm-simd.wasm`, `ort-wasm.wasm`. Lizenz: `ONNX-Runtime-MIT.txt`. Quellcode: https://github.com/microsoft/onnxruntime/tree/v1.18.0
- **Piper WASM 1.0.0**, Paket `@diffusionstudio/piper-wasm@1.0.0`: npm-Metadaten nennen MIT für das Paket. Enthalten sind unveränderte `piper_phonemize.js`, `.wasm`, `.data`. Die eingebundene eSpeak-NG-Komponente steht zusätzlich unter GPLv3; die MIT-Angabe des Pakets ersetzt diese Lizenz nicht. Veröffentlichte Bauanleitung: `Piper-WASM-README.md` und https://github.com/diffusionstudio/piper-wasm
- **Piper Phonemize 1.2.0**, Michael Hansen und Mitwirkende: MIT. Lizenz: `Piper-Phonemize-MIT.txt`. Quellcode-Snapshot einschließlich CMake-Datei: `piper-phonemize-source.tar.gz`, bezogen aus https://github.com/wide-video/piper-phonemize/tree/cfff8e52ebaea37c7e953ae2d06b174acb827ac4
- **eSpeak NG**, Jonathan Duddington, Reece H. Dunn und Mitwirkende: GPLv3. Lizenz: `eSpeak-NG-GPL3.txt`. Quellcode zu der in Piper Phonemize festgelegten Revision `0f65aa301e0d6bae5e172cc74197d32a6182200f`: `espeak-ng-source.tar.gz`. https://github.com/rhasspy/espeak-ng/tree/0f65aa301e0d6bae5e172cc74197d32a6182200f
- **Thorsten Voice / Piper, de_DE-thorsten-high**: Modell-Repository mit MIT-Metadaten; zugrunde liegender Thorsten-Datensatz laut Model Card CC0. Modell und Konfiguration unverändert aus Revision `4c56824d7a76ee98b08a6e9046e640727397fac7`: https://huggingface.co/Thorsten-Voice/Piper/tree/4c56824d7a76ee98b08a6e9046e640727397fac7 . Die Modelldatei wird für die Bereitstellung lediglich in Teile aufgeteilt. https://huggingface.co/rhasspy/piper-voices/blob/main/de/de_DE/thorsten/high/MODEL_CARD

Die Bauanleitung des WASM-Anbieters beschreibt den ursprünglichen Build mit Emscripten 3.1.47. Die Laufzeit-Binärdateien werden unverändert aus dem angegebenen npm-Paket übernommen; sie wurden für dieses Update nicht neu kompiliert. Die Original-Lizenztexte, Quellcode-Snapshots und Bauhinweise bleiben im veröffentlichten Ordner verfügbar.

## Wetter

Wetterbeobachtungen: Deutscher Wetterdienst (DWD), Open Data, abgerufen über die öffentliche Bright-Sky-Instanz. Quelle: https://www.dwd.de/DE/leistungen/opendata/opendata.html und https://brightsky.dev/ . Die gesprochene Wetterantwort nennt den DWD als Datenquelle. Ein Standort wird nur nach einer Wetterfrage und über die Browser-Standortfreigabe abgefragt; an Bright Sky werden auf zwei Nachkommastellen gerundete Koordinaten gesendet. Keine Namen, Profile oder Sprachaufnahmen werden mitgesendet.
