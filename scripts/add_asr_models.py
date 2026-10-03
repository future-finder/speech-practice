"""Append pinned CT2 candidates without changing existing model revisions."""
import json
from pathlib import Path
import httpx

path = Path(__file__).resolve().parents[1] / 'backend/speech_practice/model_manifest.json'
manifest = json.loads(path.read_text('utf8'))
for identifier, repo in [('whisper-distil', 'distil-whisper/distil-large-v3.5-ct2'),
                         ('whisper-turbo', 'mobiuslabsgmbh/faster-whisper-large-v3-turbo')]:
    metadata = httpx.get(f'https://huggingface.co/api/models/{repo}', params={'blobs': 'true'},
                        follow_redirects=True, timeout=60).raise_for_status().json()
    files = []
    for file in metadata['siblings']:
        name = file['rfilename']
        if name not in ('model.bin', 'config.json', 'tokenizer.json', 'preprocessor_config.json', 'vocabulary.json', 'vocabulary.txt'):
            continue
        files.append({'name': name, 'size': file['size'], 'algorithm': 'sha256' if file.get('lfs') else 'git-sha1',
                      'hash': file['lfs']['sha256'] if file.get('lfs') else file['blobId'],
                      'url': f'https://huggingface.co/{repo}/resolve/{metadata["sha"]}/{name}'})
    manifest[identifier] = {'name': repo.split('/')[-1] + ' / optional CT2', 'revision': metadata['sha'],
                            'license': 'MIT', 'source': f'https://huggingface.co/{repo}', 'files': files}
path.write_text(json.dumps(manifest, indent=2), 'utf8')
print({key: sum(f['size'] for f in manifest[key]['files']) for key in ('whisper-distil', 'whisper-turbo')})
