"""Recover deleted untracked files from agent subagent Write operations."""
from __future__ import annotations

import json
import subprocess
from pathlib import Path

WORKSPACE = Path(r"C:\Users\Kevin Reinhardt\Documents\CareSuite+")
TRANSCRIPT_DIR = Path(
    r"C:\Users\Kevin Reinhardt\.cursor\projects\c-Users-Kevin-Reinhardt-Documents-CareSuite\agent-transcripts\8b7d7984-0668-4bd6-b6ea-ec0a30a91448\subagents"
)

SKIP = {
    "src/design/shellEmbeddedSurface.ts",
}


def norm_rel(path: str) -> str:
    p = path.replace("\\", "/")
    ws = str(WORKSPACE).replace("\\", "/")
    if p.lower().startswith(ws.lower() + "/"):
        p = p[len(ws) + 1 :]
    return p


def main() -> None:
    tracked = {
        line.replace("/", "\\").lower()
        for line in subprocess.check_output(
            ["git", "-C", str(WORKSPACE), "ls-files"], text=True
        ).splitlines()
    }

    latest: dict[str, tuple[int, str, str]] = {}

    for fp in TRANSCRIPT_DIR.glob("*.jsonl"):
        with fp.open("r", encoding="utf-8") as handle:
            for line_no, line in enumerate(handle, 1):
                try:
                    obj = json.loads(line)
                except json.JSONDecodeError:
                    continue
                msg = obj.get("message") or {}
                for part in msg.get("content") or []:
                    if part.get("type") != "tool_use" or part.get("name") != "Write":
                        continue
                    inp = part.get("input") or {}
                    path = inp.get("path")
                    contents = inp.get("contents")
                    if not path or contents is None:
                        continue
                    rel = norm_rel(path)
                    if rel.replace("\\", "/").lower() in SKIP:
                        continue
                    key = rel.replace("\\", "/").lower()
                    prev = latest.get(key)
                    if prev is None or line_no >= prev[0]:
                        latest[key] = (line_no, contents, fp.name)

    restored: list[str] = []
    for rel_key, (_, contents, _src) in sorted(latest.items(), key=lambda x: x[1][0]):
        target = WORKSPACE / rel_key.replace("/", "\\")
        if target.exists() or rel_key.replace("/", "\\") in tracked:
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(contents, encoding="utf-8", newline="\n")
        restored.append(rel_key)

    print(f"TRANSCRIPT_RESTORED={len(restored)}")
    for path in sorted(restored):
        print(path)


if __name__ == "__main__":
    main()
