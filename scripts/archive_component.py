import hashlib
import json
import zipfile
from pathlib import Path
root = Path(__file__).resolve().parents[1]
folder = root / 'build/components/speech-qwen'
import shutil
shutil.copytree(root/'third-party/qwen', folder/'notices', dirs_exist_ok=True)
files = {}
for path in folder.rglob('*'):
    if path.is_file():
        h = hashlib.sha256()
        with path.open('rb') as data:
            for chunk in iter(lambda: data.read(1024*1024), b''):
                h.update(chunk)
        files[path.relative_to(folder).as_posix()] = h.hexdigest()
version = json.loads((root / 'package.json').read_text('utf8'))['version']
manifest = {'component':'qwen','protocol':1,'version':version,'capabilities':['qwen-tts', 'gpu-asr'],'files':files}
out = root / 'release'
out.mkdir(exist_ok=True)
archive = out / f'speech-qwen-{version}-win-x64.zip'
temporary = archive.with_suffix('.partial.zip')
with zipfile.ZipFile(temporary,'w',zipfile.ZIP_DEFLATED,compresslevel=1) as bundle:
    bundle.writestr('component.json',json.dumps(manifest))
    for name in files:
        bundle.write(folder/name,name)
temporary.replace(archive)
print(archive)
