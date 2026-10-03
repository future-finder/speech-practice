"""Refresh only the two optional entries from pinned upstream metadata."""
import json
from pathlib import Path
import httpx

MODELS = [
    ('parakeet', 'csukuangfj/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8',
     '2bda32ec70b097a55adaa07d9a7173915b43cc78', 'Parakeet TDT 0.6B v3 / CPU int8', 'CC-BY-4.0'),
    ('qwen-small', 'Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice',
     '85e237c12c027371202489a0ec509ded67b5e4b5', 'Qwen3-TTS 0.6B / NVIDIA', 'Apache-2.0'),
]


def main():
    path = Path(__file__).resolve().parents[1] / 'backend/speech_practice/model_manifest.json'
    manifest = json.loads(path.read_text('utf-8'))
    with httpx.Client(follow_redirects=True, timeout=30) as client:
        for identifier, repo, revision, name, license_name in MODELS:
            response = client.get(f'https://huggingface.co/api/models/{repo}/revision/{revision}?blobs=true')
            response.raise_for_status()
            metadata = response.json()
            if metadata['sha'] != revision:
                raise ValueError('Upstream returned a different revision.')
            files = []
            for item in metadata['siblings']:
                filename = item['rfilename']
                if filename in ('.gitattributes', 'README.md') or filename.startswith('test_wavs/'):
                    continue
                files.append({'name': filename, 'size': item['size'],
                              'url': f'https://huggingface.co/{repo}/resolve/{revision}/{filename}',
                              'algorithm': 'sha256' if item.get('lfs') else 'git-sha1',
                              'hash': item['lfs']['sha256'] if item.get('lfs') else item['blobId']})
            manifest[identifier] = {'name': name, 'revision': revision, 'license': license_name,
                                    'source': f'https://huggingface.co/{repo}', 'files': files}
    path.write_text(json.dumps(manifest, indent=2) + '\n', 'utf-8')
    print('Pinned Parakeet and Qwen3-TTS 0.6B entries updated.')


if __name__ == '__main__':
    main()
