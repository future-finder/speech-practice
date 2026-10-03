"""Copy installed distribution notices, preserving individual copyright/license texts."""
import importlib.metadata as metadata
import json
import re
import shutil
import sys
from pathlib import Path
root = Path(__file__).resolve().parents[1]
out = root / 'third-party' / ('qwen' if '--qwen' in sys.argv else 'base')
out.mkdir(parents=True, exist_ok=True)
inventory = []
for distribution in metadata.distributions():
    name = distribution.metadata['Name']
    safe = re.sub(r'[^a-zA-Z0-9_.-]', '_', name)
    folder = out / safe
    licenses = []
    for file in distribution.files or []:
        if any(word in Path(str(file)).name.lower() for word in ('license','copying','notice')):
            source = Path(distribution.locate_file(file))
            if source.is_file() and source.suffix.lower() not in ('.py','.pyc','.dll','.pyd'):
                folder.mkdir(exist_ok=True)
                target = folder / re.sub(r'[^a-zA-Z0-9_.-]', '_', str(file))
                shutil.copyfile(source,target)
                licenses.append(str(target.relative_to(out)))
    inventory.append({'name':name,'version':distribution.version,
                      'license_expression': distribution.metadata.get('License-Expression'),
                      'license_summary': (distribution.metadata.get('License') or '')[:200],
                      'sources': distribution.metadata.get_all('Project-URL') or [distribution.metadata.get('Home-page')],
                      'notices':licenses})
(out/'inventory.json').write_text(json.dumps(inventory,indent=2),'utf-8')
print(out)
