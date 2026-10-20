"""Restore tracked files NOT touched in session back to HEAD."""
from __future__ import annotations

import json
import subprocess
from pathlib import Path

WORKSPACE = Path(r"C:\Users\Kevin Reinhardt\Documents\CareSuite+")
MAIN = Path(
    r"C:\Users\Kevin Reinhardt\.cursor\projects\c-Users-Kevin-Reinhardt-Documents-CareSuite\agent-transcripts"
    r"\8b7d7984-0668-4bd6-b6ea-ec0a30a91448\8b7d7984-0668-4bd6-b6ea-ec0a30a91448.jsonl"
)
SUBAGENTS = MAIN.parent / "subagents"
CUTOFF = 2503
SKIP_AGENTS = {
    "247284f5-5ceb-4483-8c4a-7fe55e2b025c.jsonl",
    "29917001-8063-4d93-93df-d261752b7ffc.jsonl",
}


def norm(p: str) -> str:
    p = p.replace("\\", "/")
    ws = str(WORKSPACE).replace("\\", "/")
    if p.lower().startswith(ws.lower() + "/"):
        p = p[len(ws) + 1 :]
    return p.lower()


def session_files() -> set[str]:
    touched: set[str] = set()
    for fp in [MAIN, *SUBAGENTS.glob("*.jsonl")]:
        if fp.name in SKIP_AGENTS:
            continue
        with fp.open(encoding="utf-8") as f:
            for i, line in enumerate(f, 1):
                if fp == MAIN and i >= CUTOFF:
                    break
                try:
                    obj = json.loads(line)
                except json.JSONDecodeError:
                    continue
                for part in (obj.get("message") or {}).get("content") or []:
                    if part.get("type") != "tool_use":
                        continue
                    if part.get("name") not in ("Write", "StrReplace"):
                        continue
                    path = (part.get("input") or {}).get("path")
                    if path:
                        touched.add(norm(path))
    return touched


def main() -> None:
    touched = session_files()
    status = subprocess.check_output(
        ["git", "-C", str(WORKSPACE), "status", "--porcelain"], text=True
    )
    to_restore: list[str] = []
    to_keep: list[str] = []
    for line in status.splitlines():
        if not line.startswith(" M") and not line.startswith("M "):
            continue
        rel = line[3:].strip().replace("\\", "/")
        if rel.lower() in touched:
            to_keep.append(rel)
        else:
            to_restore.append(rel)

    print(f"SESSION_TOUCHED={len(touched)}")
    print(f"MODIFIED_TRACKED={len(to_keep)+len(to_restore)}")
    print(f"KEEP_SESSION={len(to_keep)}")
    print(f"RESTORE_HEAD={len(to_restore)}")

    batch = 50
    for i in range(0, len(to_restore), batch):
        chunk = to_restore[i : i + batch]
        subprocess.run(
            ["git", "-C", str(WORKSPACE), "restore", "--"] + chunk,
            check=True,
        )

    for p in sorted(to_keep)[:40]:
        print(f"  KEEP: {p}")
    if len(to_keep) > 40:
        print(f"  ... and {len(to_keep)-40} more kept")


if __name__ == "__main__":
    main()
