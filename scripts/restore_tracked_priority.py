"""Targeted Local History restore for tracked session files (pre-cutoff)."""
from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path
from urllib.parse import unquote

WORKSPACE = Path(r"C:\Users\Kevin Reinhardt\Documents\CareSuite+")
HISTORY_ROOT = Path(__file__).resolve().parents[1].parent / "AppData/Roaming/Cursor/User/History"
# fallback
import os
HISTORY_ROOT = Path(os.environ["APPDATA"]) / "Cursor" / "User" / "History"
CUTOFF_TS_MS = 1781700000000

PRIORITY = [
    "app/_layout.tsx",
    "src/components/layout/CareLightPageShell.tsx",
    "src/components/layout/CareLightScreen.tsx",
    "src/theme/colors.ts",
    "src/design/tokens/colors.ts",
    "src/design/tokens/careLightAdaptive.ts",
    "src/components/layout/DesktopShell.tsx",
    "src/components/layout/platform/PlatformShell.tsx",
    "src/hooks/useShellHostsAurora.ts",
    "metro.config.js",
    "app/office/_layout.tsx",
    "app/office/(tabs)/_layout.tsx",
    "src/lib/navigation/moduleNav/index.ts",
    "src/lib/office/officeDashboardService.ts",
    "src/hooks/useDashboard.ts",
]


def git_head(rel: str) -> str | None:
    try:
        return subprocess.check_output(
            ["git", "-C", str(WORKSPACE), "show", f"HEAD:{rel.replace(chr(92), '/')}"],
            text=True,
            errors="replace",
        )
    except subprocess.CalledProcessError:
        return None


def main() -> None:
    priority_norm = {p.replace("\\", "/").lower() for p in PRIORITY}
    restored: list[str] = []

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
        rel = unquote(m.group(1)).replace("\\", "/")
        if rel.lower() not in priority_norm:
            continue
        entries = [e for e in (data.get("entries") or []) if e.get("timestamp", 0) < CUTOFF_TS_MS]
        if not entries:
            entries = data.get("entries") or []
        pick = max(entries, key=lambda e: e.get("timestamp", 0))
        src = hist_dir / pick["id"]
        if not src.exists():
            continue
        content = src.read_text(encoding="utf-8", errors="replace")
        head = git_head(rel)
        if head is not None and head == content:
            continue
        target = WORKSPACE / rel.replace("/", "\\")
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8", newline="\n")
        restored.append(rel)

    print(f"PRIORITY_RESTORED={len(restored)}")
    for p in restored:
        print(p)


if __name__ == "__main__":
    main()
