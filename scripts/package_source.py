"""Package version-controlled application source, excluding private local files."""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import zipfile
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath

ROOT_FILES = {
    '.gitignore', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'README.md', 'README.en.md',
    'ASSET_MANIFEST.md', 'CONTRIBUTING.md', 'SECURITY.md', 'release-manifest.json',
    'package.json', 'package-lock.json', 'pyproject.toml', 'uv.lock',
    'requirements-qwen.lock', 'start.bat', 'build.bat', 'index.html',
    'vite.config.ts', 'tsconfig.json', 'playwright.config.ts',
}
SOURCE_DIRS = {'.github', 'backend', 'src', 'electron', 'scripts', 'tests', 'docs', 'third-party', 'packaging', 'public'}
PRIVATE_FILES = {
    'AGENTS.md', 'REFERENCE_SYSTEM.md', 'docs/BASELINE_ASSETS.md',
    'docs/REFERENCE_QA.md', 'docs/VISUAL_CONVERGENCE.md',
    'docs/FUNCTIONAL_GAP_REPORT_2026-10-05.md',
    'scripts/create-reference-comparison.cjs', 'src/practice-tokens.css',
}


def source_files(root: Path) -> list[str]:
    # Use the index, not a filesystem walk: ignored files can contain local data.
    raw = subprocess.check_output(['git', 'ls-files', '-z'], cwd=root)
    selected = []
    for name in raw.decode('utf8').split('\0'):
        path = PurePosixPath(name)
        if not name or name in PRIVATE_FILES:
            continue
        if name not in ROOT_FILES and path.parts[0] not in SOURCE_DIRS:
            continue
        if any(part in {'evidence', '__pycache__', 'node_modules', '.local'} for part in path.parts):
            continue
        if path.suffix.lower() in {'.pyc', '.wav', '.mp3', '.m4a', '.flac', '.ogg', '.exe', '.msi'}:
            continue
        if (root / name).is_file():
            selected.append(name)
    return sorted(set(selected))


def artifact(path: Path) -> dict:
    digest = hashlib.sha256()
    with path.open('rb') as source:
        for chunk in iter(lambda: source.read(8 * 1024 * 1024), b''):
            digest.update(chunk)
    return {'name': path.name, 'bytes': path.stat().st_size, 'sha256': digest.hexdigest()}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-only', action='store_true', help='Create only the source ZIP; no installer required.')
    parser.add_argument('--output', type=Path, help='Source ZIP destination.')
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    package = json.loads((root / 'package.json').read_text('utf8'))
    version = package['version']
    release = root / 'release'
    archive = args.output or release / f'speech-practice-{version}-source.zip'
    archive.parent.mkdir(parents=True, exist_ok=True)
    files = source_files(root)
    temporary = archive.with_suffix('.partial.zip')
    with zipfile.ZipFile(temporary, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as bundle:
        for name in files:
            bundle.write(root / name, 'speech-practice/' + name)
    temporary.replace(archive)
    if args.source_only:
        print(json.dumps({'source': archive.name, 'files': len(files)}))
        return
    component = release / f'speech-qwen-{version}-win-x64.zip'
    if not component.exists():
        component = release / 'speech-qwen-0.2.0-win-x64.zip'
    if component.exists():
        with zipfile.ZipFile(component) as bundle:
            runtime = json.loads(bundle.read('component.json'))
            if runtime.get('protocol') != 1 or not {'qwen-tts', 'gpu-asr'}.issubset(runtime.get('capabilities', [])):
                raise ValueError('The GPU component is not compatible with this release.')
    installer = release / f"{package['build']['productName']} Setup {version}.exe"
    artifacts = [artifact(installer), artifact(archive)]
    (release / 'artifacts.json').write_text(json.dumps({
        'built_at_utc': datetime.now(timezone.utc).isoformat(), 'version': version,
        'status': 'local-preview-unsigned', 'artifacts': artifacts,
    }, indent=2), encoding='utf8')
    print(json.dumps(artifacts, indent=2))


if __name__ == '__main__':
    main()
