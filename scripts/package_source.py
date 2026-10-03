"""Archive project source/locks/notices/evidence, excluding runtimes and user data."""
import hashlib
import json
import zipfile
from datetime import datetime, timezone
from pathlib import Path

root = Path(__file__).resolve().parents[1]
release = root / 'release'
release.mkdir(exist_ok=True)
files = ['.gitignore', 'AGENTS.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'README.md', 'README.en.md',
         'package.json', 'package-lock.json', 'pyproject.toml', 'uv.lock', 'requirements-qwen.lock',
         'start.bat', 'build.bat', 'index.html', 'vite.config.ts', 'tsconfig.json', 'playwright.config.ts']
for folder in ['backend', 'src', 'electron', 'scripts', 'tests', 'docs', 'third-party', 'packaging']:
    files.extend(str(p.relative_to(root)) for p in (root / folder).rglob('*')
                 if p.is_file() and '__pycache__' not in p.parts and p.suffix != '.pyc')
version = json.loads((root/'package.json').read_text('utf8'))['version']
archive = release / f'speech-practice-{version}-source.zip'
temporary = archive.with_suffix('.partial.zip')
with zipfile.ZipFile(temporary, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as bundle:
    for name in sorted(set(files)):
        bundle.write(root / name, 'speech-practice/' + Path(name).as_posix())
temporary.replace(archive)
artifacts = []
component = release / f'speech-qwen-{version}-win-x64.zip'
if not component.exists():
    # 0.2.1 adds weights, while retaining the 0.2 GPU worker protocol.
    component = release / 'speech-qwen-0.2.0-win-x64.zip'
with zipfile.ZipFile(component) as bundle:
    runtime = json.loads(bundle.read('component.json'))
    if runtime.get('protocol') != 1 or not {'qwen-tts', 'gpu-asr'}.issubset(runtime.get('capabilities', [])):
        raise ValueError('The GPU component is not compatible with this release.')
for name in [f'Speech Practice Setup {version}.exe', component.name, archive.name]:
    path = release / name
    digest = hashlib.sha256()
    with path.open('rb') as file:
        for chunk in iter(lambda: file.read(8 * 1024 * 1024), b''):
            digest.update(chunk)
    artifacts.append({'name': name, 'bytes': path.stat().st_size, 'sha256': digest.hexdigest()})
(release / 'artifacts.json').write_text(json.dumps({'built_at_utc': datetime.now(timezone.utc).isoformat(),
    'version': version, 'status': 'local-preview-unsigned', 'artifacts': artifacts}, indent=2), 'utf-8')
print(json.dumps(artifacts, indent=2))
