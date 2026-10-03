"""Download the pinned optional models into an isolated verification directory."""
import json
import os
import shutil
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / 'backend'))
from speech_practice.config import Settings
from speech_practice.models import ModelManager, verify


def main():
    settings = Settings(root / '.local/optional-model-verification')
    manager = ModelManager(settings)
    installed = Path(os.environ.get('LOCALAPPDATA', Path.home())) / 'speech-practice/models/qwen'
    # The tokenizer is identical to the existing 1.7B checkpoint. Reuse only verified bytes.
    for file in manager.model('qwen-small')['files']:
        source = installed / file['name']
        destination = manager.directory('qwen-small') / file['name']
        if source.exists() and not destination.exists() and verify(source, file):
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, destination)

    def download(identifier):
        previous = -1
        def progress(done, total):
            nonlocal previous
            step = int(done / total * 10)
            if step > previous:
                previous = step
                print(f'{identifier}: {done / total:.0%}', flush=True)
        manager.download(identifier, progress)
        print(f'{identifier}: verified', flush=True)
    with ThreadPoolExecutor(max_workers=2) as pool:
        list(pool.map(download, ('parakeet', 'qwen-small')))
    print(json.dumps({'model_dir': str(settings.models)}), flush=True)


if __name__ == '__main__':
    main()
