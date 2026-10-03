import hashlib
import json
import shutil
from pathlib import Path
import httpx

MANIFEST_PATH = Path(__file__).with_name("model_manifest.json")


def digest(path, algorithm):
    size = path.stat().st_size
    h = hashlib.sha256() if algorithm == "sha256" else hashlib.sha1()
    if algorithm == "git-sha1":
        h.update(f"blob {size}\0".encode())
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def verify(path, file):
    return path.exists() and path.stat().st_size == file["size"] and digest(path, file["algorithm"]) == file["hash"]


def download_file(file, destination, progress=lambda *_: None):
    destination.parent.mkdir(parents=True, exist_ok=True)
    if verify(destination, file):
        progress(file["size"], file["size"])
        return
    partial = destination.with_name(destination.name + ".partial")
    offset = partial.stat().st_size if partial.exists() else 0
    if offset > file["size"]:
        partial.unlink()
        offset = 0
    with httpx.Client(follow_redirects=True, timeout=httpx.Timeout(60, connect=20)) as client:
        with client.stream("GET", file["url"], headers={"Range": f"bytes={offset}-"} if offset else {}) as response:
            if response.status_code == 416:
                if partial.stat().st_size == file["size"] and verify(partial, file):
                    partial.replace(destination)
                    return
                partial.unlink(missing_ok=True)
                raise ValueError("Invalid partial download. Retry to restart.")
            response.raise_for_status()
            if response.status_code != 206:
                offset = 0
            elif not response.headers.get("content-range", "").startswith(f"bytes {offset}-"):
                raise ValueError("Invalid download range response.")
            with partial.open("ab" if offset else "wb") as target:
                for chunk in response.iter_bytes(1024 * 512):
                    target.write(chunk)
                    offset += len(chunk)
                    if offset > file["size"]:
                        raise ValueError("Download larger than the manifest.")
                    progress(offset, file["size"])
    if not verify(partial, file):
        partial.unlink(missing_ok=True)
        raise ValueError("Model checksum mismatch. Download was discarded; retry.")
    partial.replace(destination)


class ModelManager:
    def __init__(self, settings):
        self.settings = settings
        self.manifest = json.loads(MANIFEST_PATH.read_text("utf-8"))

    def model(self, id):
        if id not in self.manifest:
            raise ValueError("Unknown model.")
        return self.manifest[id]

    def directory(self, id):
        self.model(id)
        return self.settings.models / id

    def ready(self, id):
        entry = self.model(id)
        directory = self.directory(id)
        marker = directory / ".verified.json"
        if not marker.exists():
            return False
        try:
            previous = json.loads(marker.read_text("utf-8"))
            if previous["revision"] != entry["revision"]:
                return False
            return all((directory / f["name"]).stat().st_size == f["size"] and
                       (directory / f["name"]).stat().st_mtime_ns == previous["mtimes"][f["name"]] for f in entry["files"])
        except (OSError, KeyError, ValueError):
            return False

    def mark(self, id):
        directory = self.directory(id)
        entry = self.model(id)
        (directory / ".verified.json").write_text(json.dumps({"revision": entry["revision"], "mtimes": {
            f["name"]: (directory / f["name"]).stat().st_mtime_ns for f in entry["files"]}}), "utf-8")

    def download(self, id, progress=lambda *_: None):
        entry = self.model(id)
        total = sum(f["size"] for f in entry["files"])
        self.settings.models.mkdir(parents=True, exist_ok=True)
        remaining = sum(max(0, f['size'] - ((self.directory(id) / f['name']).stat().st_size if (self.directory(id) / f['name']).exists() else
                            (self.directory(id) / (f['name'] + '.partial')).stat().st_size if (self.directory(id) / (f['name'] + '.partial')).exists() else 0)) for f in entry['files'])
        if shutil.disk_usage(self.settings.models).free < remaining + 256 * 1024 ** 2:
            raise ValueError('Insufficient model disk space. Choose another model directory or free space; existing recordings are preserved.')
        completed = 0
        for file in entry["files"]:
            file = dict(file)
            if self.settings.values.get('model_source') == 'hf-mirror' and file['url'].startswith('https://huggingface.co/'):
                file['url'] = file['url'].replace('https://huggingface.co/', 'https://hf-mirror.com/', 1)
            download_file(file, self.directory(id) / file["name"], lambda done, size: progress(completed + done, total))
            completed += file["size"]
        self.mark(id)
        return {"model": id, "path": str(self.directory(id))}

    def import_directory(self, id, source):
        directory = Path(source).resolve()
        if not directory.is_dir():
            raise ValueError("Select a model directory.")
        for file in self.model(id)["files"]:
            path = directory / file["name"]
            if not verify(path, file):
                raise ValueError(f"Missing or invalid model file: {file['name']}")
        destination = self.directory(id)
        if directory != destination.resolve():
            for file in self.model(id)["files"]:
                target = destination / file["name"]
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(directory / file["name"], target)
        self.mark(id)
        return {"model": id, "path": str(destination)}

    def delete(self, id):
        directory = self.directory(id).resolve()
        root = self.settings.models.resolve()
        if directory.parent != root:
            raise ValueError("Unsafe model directory.")
        if directory.exists():
            shutil.rmtree(directory)

    def list(self):
        return [{"id": id, "name": entry["name"], "revision": entry["revision"], "license": entry["license"],
                 "source": entry["source"], "size": sum(f["size"] for f in entry["files"]),
                 "ready": self.ready(id), "path": str(self.directory(id))} for id, entry in self.manifest.items()]
