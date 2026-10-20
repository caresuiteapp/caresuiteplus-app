"""Generate gap report: expected session files vs working tree."""
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
SKIP = {"247284f5-5ceb-4483-8c4a-7fe55e2b025c.jsonl", "29917001-8063-4d93-93df-d261752b7ffc.jsonl"}


def norm(p: str) -> str:
    p = p.replace("\\", "/")
    ws = str(WORKSPACE).replace("\\", "/")
    if p.lower().startswith(ws.lower() + "/"):
        p = p[len(ws) + 1 :]
    return p


def expected_files() -> set[str]:
    out: set[str] = set()
    for fp in [MAIN, *SUBAGENTS.glob("*.jsonl")]:
        if fp.name in SKIP:
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
                        out.add(norm(path))
    return out


def main() -> None:
    expected = expected_files()
    missing = sorted(p for p in expected if not (WORKSPACE / p).exists())
    print(f"EXPECTED_TOUCHED={len(expected)}")
    print(f"MISSING_ON_DISK={len(missing)}")
    for p in missing[:80]:
        print(f"  MISSING: {p}")
    if len(missing) > 80:
        print(f"  ... and {len(missing)-80} more")

    status = subprocess.check_output(
        ["git", "-C", str(WORKSPACE), "status", "--porcelain"], text=True
    )
    untracked = sum(1 for l in status.splitlines() if l.startswith("??"))
    modified = sum(1 for l in status.splitlines() if l.startswith(" M") or l.startswith("M "))
    print(f"\nGIT_UNTRACKED={untracked}")
    print(f"GIT_MODIFIED_TRACKED={modified}")


if __name__ == "__main__":
    main()
