"""Prepare pinned, integrity-checked web dependencies without running npm lifecycle scripts."""
from pathlib import Path
import base64, hashlib, io, json, shutil, tarfile, urllib.request
root = Path(__file__).resolve().parents[1]
(root / 'web/src').mkdir(parents=True, exist_ok=True)
home = root.parent
research = home / 'Research/Better-Lyrics'
dest = root / 'web/node_modules'
dest.mkdir(parents=True, exist_ok=True)
lock = json.loads((root / 'web/braccato-lock.json').read_text(encoding='utf-8'))
for name, package in lock.items():
    target = dest / '@braccato' / name
    manifest = target / 'package.json'
    if manifest.exists():
        installed = json.loads(manifest.read_text(encoding='utf-8'))['version']
        if installed == package['version']:
            continue
    with urllib.request.urlopen(package['url'], timeout=25) as response:
        content = response.read()
    integrity = 'sha512-' + base64.b64encode(hashlib.sha512(content).digest()).decode()
    if integrity != package['integrity']:
        raise ValueError(f'Package integrity mismatch: {name}')
    staging = target.with_name(f"{name}-{package['version']}.staged")
    staging.mkdir(parents=True)
    with tarfile.open(fileobj=io.BytesIO(content), mode='r:gz') as archive:
        for item in archive:
            path = Path(item.name)
            if not item.isfile() or path.parts[0] != 'package' or '..' in path.parts:
                continue
            output = staging.joinpath(*path.parts[1:])
            output.parent.mkdir(parents=True, exist_ok=True)
            output.write_bytes(archive.extractfile(item).read())
    if target.exists():
        target.rename(target.with_name(f'{name}-{installed}.retained'))
    staging.rename(target)
for source in (research / 'Packages/node_modules').iterdir():
    target = dest / source.name
    if source.is_dir() and not target.exists():
        shutil.copytree(source, target)
tools = root / 'web/tools/esbuild'
if not (tools / 'esbuild.exe').exists():
    with urllib.request.urlopen('https://registry.npmjs.org/@esbuild/win32-x64/0.25.12') as f:
        metadata = json.load(f)
    with urllib.request.urlopen(metadata['dist']['tarball']) as f:
        content = f.read()
    expected = metadata['dist']['integrity'].removeprefix('sha512-')
    assert base64.b64encode(hashlib.sha512(content).digest()).decode() == expected
    tools.mkdir(parents=True, exist_ok=True)
    with tarfile.open(fileobj=io.BytesIO(content), mode='r:gz') as archive:
        for name in ('package/esbuild.exe', 'package/README.md'):
            (tools / Path(name).name).write_bytes(archive.extractfile(name).read())
    (tools / 'registry.json').write_text(json.dumps(metadata, indent=2), encoding='utf-8')
# The repository owns the adapted provider code in web/src.
styles = dest / '@braccato/core/dist/styles'
assets = root / 'patches/src/main/resources/bdcrusher-lyrics'
assets.mkdir(parents=True, exist_ok=True)
for item in styles.glob('*.css'):
    shutil.copy2(item, assets / item.name)
font = research / 'Sources/better-lyrics-272d7c16c9e8/public/fonts/Satoshi-Variable.woff2'
shutil.copy2(font, assets / font.name)
licenses = root / 'third-party-notices'
licenses.mkdir(exist_ok=True)
shutil.copy2(dest / '@braccato/core/dist/LICENSE', licenses / 'Braccato-core-MIT.txt')
shutil.copy2(research / 'Sources/better-lyrics-272d7c16c9e8/LICENSE', licenses / 'Better-Lyrics-GPL-3.0.txt')
shutil.copy2(dest / '@braccato/parsers/LICENSE', licenses / 'Braccato-parsers-MIT.txt')
shutil.copy2(research / 'Sources/better-lyrics-272d7c16c9e8/public/fonts/NOTICE.txt', licenses / 'Fonts-NOTICE.txt')
for package in dest.rglob('package.json'):
    if any(part.endswith('.retained') for part in package.parts):
        continue
    folder=package.parent
    for notice in folder.glob('*'):
        if notice.is_file() and notice.name.lower().startswith(('license','licence','notice','copying')):
            label=folder.relative_to(dest).as_posix().replace('/','_')+'-'+notice.name
            shutil.copy2(notice,licenses/label)
print('Pinned Braccato 1.21.5 / parsers 0.4.2 and esbuild 0.25.12 prepared')
