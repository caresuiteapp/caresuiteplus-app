"""Force-restore specific corrupt files from agent transcript Write ops (latest wins)."""
from __future__ import annotations

import json
from pathlib import Path

WORKSPACE = Path(__file__).resolve().parents[1]
TRANSCRIPT_DIR = Path(
    r"C:\Users\Kevin Reinhardt\.cursor\projects\c-Users-Kevin-Reinhardt-Documents-CareSuite\agent-transcripts\8b7d7984-0668-4bd6-b6ea-ec0a30a91448\subagents"
)

FORCE_TARGETS = {
    "src/components/office/officemessagethread.tsx",
    "src/components/office/officemessagecontextpanel.tsx",
    "src/components/office/officemessagesinbox.tsx",
    "src/components/office/officenewchatmodal.tsx",
    "src/components/layout/platform/moduledashboardshell.tsx",
}


def norm_rel(path: str) -> str:
    p = path.replace("\\", "/")
    ws = str(WORKSPACE).replace("\\", "/")
    if p.lower().startswith(ws.lower() + "/"):
        p = p[len(ws) + 1 :]
    return p.lower()


def main() -> None:
    latest: dict[str, tuple[int, str]] = {}

    for fp in TRANSCRIPT_DIR.glob("*.jsonl"):
        with fp.open("r", encoding="utf-8") as handle:
            for line_no, line in enumerate(handle, 1):
                try:
                    obj = json.loads(line)
                except json.JSONDecodeError:
                    continue
                for part in (obj.get("message") or {}).get("content") or []:
                    if part.get("type") != "tool_use" or part.get("name") != "Write":
                        continue
                    inp = part.get("input") or {}
                    path = inp.get("path")
                    contents = inp.get("contents")
                    if not path or not contents:
                        continue
                    rel = norm_rel(path)
                    if rel not in FORCE_TARGETS:
                        continue
                    if "export * from" in contents and len(contents) < 80:
                        continue
                    prev = latest.get(rel)
                    if prev is None or line_no >= prev[0]:
                        latest[rel] = (line_no, contents)

    for rel, (_, contents) in sorted(latest.items()):
        target = WORKSPACE / rel.replace("/", "\\")
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(contents, encoding="utf-8", newline="\n")
        print(f"RESTORED {rel} ({len(contents)} chars)")

    missing = FORCE_TARGETS - set(latest)
    if missing:
        print("MISSING:", ", ".join(sorted(missing)))


if __name__ == "__main__":
    main()
