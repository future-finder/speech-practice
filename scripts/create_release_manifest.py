"""Create a release manifest for checked Windows artifacts.

The script never packages model weights. It records only files explicitly passed
on the command line, with size and SHA-256 so a release page can be verified.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path


def digest(path: Path) -> tuple[int, str]:
    hasher = hashlib.sha256()
    size = 0
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            size += len(block)
            hasher.update(block)
    return size, hasher.hexdigest()


def artifact(path: Path, root: Path) -> dict[str, object]:
    size, sha256 = digest(path)
    return {"filename": path.name, "size_bytes": size, "sha256": sha256,
            "path": path.relative_to(root).as_posix()}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--version", required=True)
    parser.add_argument("--installer", type=Path, required=True)
    parser.add_argument("--component", type=Path, action="append", default=[])
    parser.add_argument("--output", type=Path, default=Path("release-manifest.json"))
    args = parser.parse_args()
    root = Path.cwd().resolve()
    paths = [args.installer, *args.component]
    files = []
    for raw in paths:
        path = raw.resolve()
        if not path.is_file():
            raise SystemExit(f"artifact not found: {raw}")
        files.append(artifact(path, root))
    manifest = {
        "version": args.version,
        "platform": "windows-x64",
        "release_type": "beta",
        "windows_installer": files[0],
        "optional_components": files[1:],
        "models_included": False,
    }
    args.output.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
