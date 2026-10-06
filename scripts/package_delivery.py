"""Build a curated beta handoff, without models, credentials or user recordings."""
import hashlib
import json
import shutil
import zipfile
from pathlib import Path

root = Path(__file__).resolve().parents[1]
version = json.loads((root / 'package.json').read_text('utf-8'))['version']
release = root / 'release'
delivery = release / 'delivery' / f'speech-practice-{version}-win-x64'
delivery.mkdir(parents=True, exist_ok=True)
for source, name in [
    (release / f'Oracy Setup {version}.exe', f'Oracy Setup {version}.exe'),
    (release / f'speech-practice-{version}-source.zip', f'speech-practice-{version}-source.zip'),
    (root / 'docs/DELIVERY_0.2.2.md', '使用说明.md'),
    (root / 'docs/RELEASE_0.2.2.md', '版本与验证说明.md'),
    (root / 'LICENSE', 'LICENSE'),
    (root / 'THIRD_PARTY_NOTICES.md', 'THIRD_PARTY_NOTICES.md'),
    (root / 'release-manifest.json', 'release-manifest.json'),
    (root / 'docs/evidence/frontend-redesign/electron-smoke.json', '桌面验证.json'),
    (root / 'docs/evidence/packaged-smoke.json', '后端验证.json'),
]:
    shutil.copy2(source, delivery / name)
screens = delivery / 'screenshots'
screens.mkdir(exist_ok=True)
for name in ['electron-practice.png', 'electron-sidebar-collapsed.png', 'settings.png', 'library.png', 'summary-real-recordings.png', 'analysis-local-recognition.png']:
    shutil.copy2(root / 'docs/evidence/frontend-redesign' / name, screens / name)
checks = []
for file in sorted(delivery.rglob('*')):
    if file.is_file() and file.name != 'SHA256SUMS.txt':
        checks.append(hashlib.file_digest(file.open('rb'), 'sha256').hexdigest() + '  ' + file.relative_to(delivery).as_posix())
(delivery / 'SHA256SUMS.txt').write_text('\n'.join(checks) + '\n', 'utf-8')
archive = release / f'speech-practice-{version}-delivery-win-x64.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as bundle:
    for file in sorted(delivery.rglob('*')):
        if file.is_file():
            bundle.write(file, delivery.name + '/' + file.relative_to(delivery).as_posix())
with zipfile.ZipFile(archive) as bundle:
    assert bundle.testzip() is None
print(json.dumps({'directory': str(delivery), 'archive': str(archive), 'bytes': archive.stat().st_size, 'sha256': hashlib.file_digest(archive.open('rb'), 'sha256').hexdigest()}, indent=2))
