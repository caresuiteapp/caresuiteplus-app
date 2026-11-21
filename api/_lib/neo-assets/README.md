NEO build assets are prepared by scripts/prepare-neo-vercel.mjs before the existing production release gates. No model or executable is committed here.

The preparer verifies the pinned Whisper Base Q5 model and portable whisper.cpp WASM runtime, builds a native Linux x64 engine from vendor/neo-whisper using existing GCC/G++, and tests recognition with synthetic German audio. The manifest binds successful tests to artifact hashes. The request runtime checks integrity, CPU features and native ABI again; unsupported native runtimes use the verified WASM path inside Vercel.

These public model/runtime assets need read permissions in the deployed function, and the native executable needs execute permissions. They contain no account, microphone or clinical data. Request audio is private, temporary and deleted after processing. The worker keeps transcripts in private memory/IPC and does not forward runtime stdout/stderr to function logs.

A missing, changed or untested manifest disables recognition. No external transcription API is used. The model and whisper.cpp are third-party components; attribution and versions are recorded in docs/neo-r22-construction.md and vendor/neo-whisper/NOTICE.md.
