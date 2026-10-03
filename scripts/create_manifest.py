"""Maintainer-only: regenerate pinned model hashes from official metadata."""
import json
from pathlib import Path
import urllib.request

def get(url):
    with urllib.request.urlopen(url) as response:
        return json.load(response)

path = Path(__file__).resolve().parents[1] / 'backend/speech_practice/model_manifest.json'
manifest = json.loads(path.read_text('utf8')) if path.exists() else {}
release = get('https://api.github.com/repos/thewh1teagle/kokoro-onnx/releases/tags/model-files-v1.1')
assets = [a for a in release['assets'] if a['name'] in ('kokoro-v1.0.onnx', 'voices-v1.0.bin')]
manifest['kokoro'] = {'name': 'Kokoro 82M / CPU', 'revision': 'model-files-v1.1', 'license': 'Apache-2.0 (model), MIT (wrapper)',
    'source': 'https://github.com/thewh1teagle/kokoro-onnx', 'files': [
        {'name': a['name'], 'size': a['size'], 'url': a['browser_download_url'], 'algorithm': 'sha256', 'hash': a['digest'].split(':')[1]} for a in assets]}
for id, repo, license in [('whisper', 'Systran/faster-whisper-small.en', 'MIT'), ('qwen', 'Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice', 'Apache-2.0')]:
    metadata = get(f'https://huggingface.co/api/models/{repo}/revision/main?blobs=true')
    files = []
    for f in metadata['siblings']:
        name = f['rfilename']
        if name in ('.gitattributes', 'README.md'):
            continue
        files.append({'name': name, 'size': f['size'], 'url': f"https://huggingface.co/{repo}/resolve/{metadata['sha']}/{name}",
                      'algorithm': 'sha256' if f.get('lfs') else 'git-sha1', 'hash': f['lfs']['sha256'] if f.get('lfs') else f['blobId']})
    manifest[id] = {'name': 'Whisper small.en / CPU int8' if id == 'whisper' else 'Qwen3-TTS 1.7B / NVIDIA',
                    'revision': metadata['sha'], 'license': license, 'source': f'https://huggingface.co/{repo}', 'files': files}
path = Path(__file__).resolve().parents[1] / 'backend/speech_practice/model_manifest.json'
path.write_text(json.dumps(manifest, indent=2), 'utf-8')
print(path)
