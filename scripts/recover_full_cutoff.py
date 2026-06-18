"""Exhaustive recovery to chat cutoff (line 2503, before agent 247284f5).

Sources:
  1. Agent transcripts (Write + StrReplace, chronological)
  2. Cursor Local History (tracked + untracked, timestamp < cutoff)
  3. Git dangling objects (optional restore list)

Cutoff: undo white-background agent 247284f5 and everything after line 2503.
Keep: full session work through aurora restore (483bf39c).
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
from urllib.parse import unquote

WORKSPACE = Path(r"C:\Users\Kevin Reinhardt\Documents\CareSuite+")
MAIN_TRANSCRIPT = Path(
    r"C:\Users\Kevin Reinhardt\.cursor\projects\c-Users-Kevin-Reinhardt-Documents-CareSuite\agent-transcripts"
    r"\8b7d7984-0668-4bd6-b6ea-ec0a30a91448\8b7d7984-0668-4bd6-b6ea-ec0a30a91448.jsonl"
)
SUBAGENT_DIR = MAIN_TRANSCRIPT.parent / "subagents"
HISTORY_ROOT = Path(os.environ.get("APPDATA", "")) / "Cursor" / "User" / "History"

# Before white-background agent 247284f5 (~line 2499)
CUTOFF_TS_MS = 1781700000000
MAIN_CUTOFF_LINE = 2503

# Post-cutoff subagents — skip entirely
SKIP_SUBAGENTS = {
    "247284f5-5ceb-4483-8c4a-7fe55e2b025c.jsonl",  # white background removal
    "29917001-8063-4d93-93df-d261752b7ffc.jsonl",  # destructive revert
    "e9165e68-6395-424c-9f40-b8e9b62b6844.jsonl",  # recovery (may overwrite)
}

# Files whose transcript writes are post-cutoff design chaos
SKIP_PATHS = {
    "src/design/shellEmbeddedSurface.ts",
    "src/design/shellEmbeddedSurface.ts".lower(),
}


@dataclass(order=True)
class Op:
    order: int
    kind: str = field(compare=False)
    rel: str = field(compare=False)
    data: dict[str, Any] = field(compare=False, default_factory=dict)
    source: str = field(compare=False, default="")


def norm_rel(path: str) -> str:
    p = path.replace("\\", "/")
    ws = str(WORKSPACE).replace("\\", "/")
    if p.lower().startswith(ws.lower() + "/"):
        p = p[len(ws) + 1 :]
    return p


def git_tracked() -> set[str]:
    out = subprocess.check_output(
        ["git", "-C", str(WORKSPACE), "ls-files"], text=True, errors="replace"
    )
    return {line.replace("/", "\\").lower() for line in out.splitlines()}


def git_head_content(rel: str) -> str | None:
    rel_posix = rel.replace("\\", "/")
    try:
        return subprocess.check_output(
            ["git", "-C", str(WORKSPACE), "show", f"HEAD:{rel_posix}"],
            text=True,
            errors="replace",
        )
    except subprocess.CalledProcessError:
        return None


def iter_transcript_ops() -> list[Op]:
    ops: list[Op] = []
    order = 0

    def consume_file(fp: Path, max_line: int | None = None) -> None:
        nonlocal order
        with fp.open("r", encoding="utf-8") as handle:
            for line_no, line in enumerate(handle, 1):
                if max_line is not None and line_no >= max_line:
                    break
                try:
                    obj = json.loads(line)
                except json.JSONDecodeError:
                    continue
                msg = obj.get("message") or {}
                for part in msg.get("content") or []:
                    if part.get("type") != "tool_use":
                        continue
                    name = part.get("name")
                    inp = part.get("input") or {}
                    if name == "Write":
                        path = inp.get("path")
                        contents = inp.get("contents")
                        if not path or contents is None:
                            continue
                        rel = norm_rel(path)
                        if rel.lower() in {s.lower() for s in SKIP_PATHS}:
                            continue
                        ops.append(
                            Op(
                                order,
                                "write",
                                rel,
                                {"contents": contents},
                                f"{fp.name}:{line_no}",
                            )
                        )
                        order += 1
                    elif name == "StrReplace":
                        path = inp.get("path")
                        if not path:
                            continue
                        rel = norm_rel(path)
                        if rel.lower() in {s.lower() for s in SKIP_PATHS}:
                            continue
                        ops.append(
                            Op(
                                order,
                                "strreplace",
                                rel,
                                {
                                    "old_string": inp.get("old_string", ""),
                                    "new_string": inp.get("new_string", ""),
                                    "replace_all": bool(inp.get("replace_all")),
                                },
                                f"{fp.name}:{line_no}",
                            )
                        )
                        order += 1

    if MAIN_TRANSCRIPT.exists():
        consume_file(MAIN_TRANSCRIPT, MAIN_CUTOFF_LINE)

    for fp in sorted(SUBAGENT_DIR.glob("*.jsonl")):
        if fp.name in SKIP_SUBAGENTS:
            continue
        consume_file(fp, None)

    ops.sort()
    return ops


def apply_strreplace(content: str, old: str, new: str, replace_all: bool) -> str | None:
    if not old:
        return None
    if replace_all:
        if old not in content:
            return None
        return content.replace(old, new)
    if old not in content:
        return None
    return content.replace(old, new, 1)


def apply_transcript_ops(ops: list[Op], tracked: set[str]) -> tuple[dict[str, str], list[str], list[str]]:
    """Return final content map, restored paths, failed strreplaces."""
    files: dict[str, str] = {}
    failed: list[str] = []
    restored: list[str] = []

    for op in ops:
        rel = op.rel.replace("/", "\\")
        key = rel.lower()

        if op.kind == "write":
            files[key] = op.data["contents"]
            continue

        if op.kind == "strreplace":
            if key not in files:
                head = git_head_content(rel)
                if head is not None:
                    files[key] = head
                elif (WORKSPACE / rel).exists():
                    files[key] = (WORKSPACE / rel).read_text(encoding="utf-8", errors="replace")
                else:
                    failed.append(f"{rel} (no base): {op.source}")
                    continue
            updated = apply_strreplace(
                files[key],
                op.data["old_string"],
                op.data["new_string"],
                op.data["replace_all"],
            )
            if updated is None:
                failed.append(f"{rel}: {op.source}")
            else:
                files[key] = updated

    for key, content in files.items():
        # recover casing from ops
        rel = next((o.rel for o in reversed(ops) if o.rel.replace("/", "\\").lower() == key), key)
        target = WORKSPACE / rel.replace("/", "\\")
        is_tracked = key in tracked
        existed = target.exists()
        current = target.read_text(encoding="utf-8", errors="replace") if existed else None

        if current == content:
            continue

        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8", newline="\n")
        restored.append(rel.replace("/", "\\"))

    return files, restored, failed


def local_history_restore(tracked: set[str]) -> tuple[list[str], list[str]]:
    restored: list[str] = []
    skipped_post_cutoff: list[str] = []

    if not HISTORY_ROOT.exists():
        return restored, skipped_post_cutoff

    for hist_dir in HISTORY_ROOT.iterdir():
        if not hist_dir.is_dir():
            continue
        entries_file = hist_dir / "entries.json"
        if not entries_file.exists():
            continue
        try:
            data = json.loads(entries_file.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue

        resource = data.get("resource") or ""
        m = re.search(r"CareSuite%2B/(.+)$", resource)
        if not m:
            continue

        rel = unquote(m.group(1)).replace("/", "\\")
        rel_norm = rel.lower()
        target = WORKSPACE / rel

        entries = data.get("entries") or []
        if not entries:
            continue

        # pick latest entry BEFORE cutoff (exclude post-cutoff design work)
        before = [e for e in entries if e.get("timestamp", 0) < CUTOFF_TS_MS]
        pick = max(before, key=lambda e: e.get("timestamp", 0)) if before else None
        if not pick:
            pick = min(entries, key=lambda e: e.get("timestamp", 0))

        src = hist_dir / pick["id"]
        if not src.exists():
            continue

        hist_content = src.read_text(encoding="utf-8", errors="replace")
        is_tracked = rel_norm in tracked

        if is_tracked:
            head = git_head_content(rel)
            if head is not None and head == hist_content:
                continue
        elif target.exists():
            try:
                if target.read_text(encoding="utf-8", errors="replace") == hist_content:
                    continue
            except OSError:
                pass

        # For tracked files: only restore if different from HEAD
        if is_tracked:
            head = git_head_content(rel)
            if head is not None and head == hist_content:
                continue

        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(hist_content, encoding="utf-8", newline="\n")
        restored.append(rel)

    return restored, skipped_post_cutoff


def main() -> int:
    tracked = git_tracked()
    print("=== Phase 1: Transcript ops ===")
    ops = iter_transcript_ops()
    print(f"OPS_COLLECTED={len(ops)}")
    _, tx_restored, tx_failed = apply_transcript_ops(ops, tracked)
    print(f"TRANSCRIPT_WRITTEN={len(tx_restored)}")
    if tx_failed:
        print(f"TRANSCRIPT_STRREPLACE_FAILED={len(tx_failed)}")
        for f in tx_failed[:30]:
            print(f"  FAIL: {f}")
        if len(tx_failed) > 30:
            print(f"  ... and {len(tx_failed) - 30} more")

    print("\n=== Phase 2: Local History ===")
    lh_restored, _ = local_history_restore(tracked)
    print(f"LOCAL_HISTORY_RESTORED={len(lh_restored)}")
    for p in sorted(lh_restored)[:50]:
        print(f"  {p}")
    if len(lh_restored) > 50:
        print(f"  ... and {len(lh_restored) - 50} more")

    print("\n=== Phase 3: Git status summary ===")
    status = subprocess.check_output(
        ["git", "-C", str(WORKSPACE), "status", "--porcelain"],
        text=True,
        errors="replace",
    )
    untracked = sum(1 for l in status.splitlines() if l.startswith("??"))
    modified = sum(1 for l in status.splitlines() if l.startswith(" M") or l.startswith("M "))
    print(f"UNTRACKED={untracked}")
    print(f"MODIFIED_TRACKED={modified}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
