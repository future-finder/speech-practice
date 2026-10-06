"""Install a user-selected component archive; never extract arbitrary ZIP paths."""
import hashlib
import json
import shutil
import stat
import zipfile
from pathlib import Path, PurePosixPath


def install_qwen(settings, archive):
    source = Path(archive)
    if not source.is_file() or source.suffix.lower() != ".zip":
        raise ValueError("Select a Oracy Qwen component ZIP.")
    staging = settings.root / "components" / "qwen-staging"
    destination = settings.root / "components" / "qwen"
    # Fixed paths, verified to remain inside the app's component directory.
    root = (settings.root / "components").resolve()
    for folder in (staging, destination):
        if folder.resolve().parent != root:
            raise ValueError("Unsafe component directory.")
    if staging.exists():
        shutil.rmtree(staging)
    staging.mkdir(parents=True)
    try:
        with zipfile.ZipFile(source) as bundle:
            if sum(i.file_size for i in bundle.infolist()) > 20 * 1024 ** 3:
                raise ValueError("Component archive exceeds 20 GB.")
            manifest = json.loads(bundle.read("component.json"))
            if manifest.get("component") != "qwen" or manifest.get("protocol") != 1 or "speech-qwen.exe" not in manifest.get("files", {}):
                raise ValueError("Invalid component manifest.")
            for info in bundle.infolist():
                name = PurePosixPath(info.filename)
                if name.is_absolute() or ".." in name.parts or "\\" in info.filename or ":" in info.filename or stat.S_ISLNK(info.external_attr >> 16):
                    raise ValueError("Unsafe component archive path.")
                if info.is_dir():
                    continue
                if info.filename != "component.json" and info.filename not in manifest["files"]:
                    raise ValueError("Unlisted component file.")
                target = staging.joinpath(*name.parts)
                target.parent.mkdir(parents=True, exist_ok=True)
                h = hashlib.sha256()
                with bundle.open(info) as incoming, target.open("wb") as output:
                    for chunk in iter(lambda: incoming.read(1024 * 1024), b""):
                        h.update(chunk)
                        output.write(chunk)
                if info.filename != "component.json" and h.hexdigest() != manifest["files"][info.filename]:
                    raise ValueError("Component checksum mismatch.")
            if any(not (staging / name).is_file() for name in manifest["files"]):
                raise ValueError("Incomplete component archive.")
        if destination.exists():
            shutil.rmtree(destination)
        staging.replace(destination)
        return {"installed": True, "path": str(destination)}
    finally:
        if staging.exists():
            shutil.rmtree(staging)
