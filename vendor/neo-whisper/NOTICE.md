# NEO native speech source closure

These files are an unmodified minimal CPU/CLI source closure from whisper.cpp v1.8.4, commit 9386f239401074690479731c1e41683fbbeac557, https://github.com/ggml-org/whisper.cpp. The upstream checkout was clean and exactly tagged before extraction.

The upstream MIT license and AUTHORS are retained. `examples/miniaudio.h` includes its public-domain/MIT licensing terms; `examples/stb_vorbis.c` includes its public-domain/MIT terms. Those original notices are preserved in full inside the distributed headers. No static glibc, libstdc++, OpenMP, or other system runtime archive is distributed by this source package.

The application build script is CareSuite-specific. It uses an already present GCC/G++ toolchain on Linux x64 and dynamically links the target build environment runtime libraries. It does not install CMake, compilers, or packages. It does not use `-march=native`. The resulting executable requires AVX2, FMA, and F16C; the request runtime must check those capabilities before invoking it. A successful local build or `--help` alone does not prove Vercel Lambda compatibility or recognition quality.

SHA-256 source checks use explicitly normalised UTF-8/LF text to accommodate Windows Git checkouts. Runtime executable checks use the unmodified binary bytes.
