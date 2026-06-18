"""Fix bad URL-encoded paths from failed Local History restore."""
from __future__ import annotations

import shutil
from pathlib import Path
from urllib.parse import unquote

WORKSPACE = Path(r"C:\Users\Kevin Reinhardt\Documents\CareSuite+")


def main() -> None:
    removed = 0
    moved = 0
    for path in list(WORKSPACE.rglob("*")):
        if "%" not in path.name:
            continue
        decoded_name = unquote(path.name)
        if decoded_name == path.name:
            continue
        target = path.parent / decoded_name
        if path.is_file():
            if not target.exists():
                target.parent.mkdir(parents=True, exist_ok=True)
                path.rename(target)
                moved += 1
            else:
                path.unlink()
                removed += 1
        elif path.is_dir():
            if not target.exists():
                path.rename(target)
                moved += 1
            else:
                shutil.rmtree(path)
                removed += 1
    print(f"MOVED={moved}")
    print(f"REMOVED_DUPLICATES={removed}")


if __name__ == "__main__":
    main()
