"""Fetch only pinned esbuild, checking its registry SHA-512; no npm lifecycle scripts."""
from pathlib import Path
import urllib.request,json,hashlib,base64,tarfile,io
root=Path(__file__).resolve().parents[1]
dest=root/'Personal-Patches/web/tools/esbuild';dest.mkdir(parents=True,exist_ok=True)
meta=json.load(urllib.request.urlopen('https://registry.npmjs.org/@esbuild/win32-x64/0.25.12',timeout=60))
raw=urllib.request.urlopen(meta['dist']['tarball'],timeout=90).read()
assert 'sha512-'+base64.b64encode(hashlib.sha512(raw).digest()).decode()==meta['dist']['integrity']
with tarfile.open(fileobj=io.BytesIO(raw),mode='r:gz') as tar:
 (dest/'esbuild.exe').write_bytes(tar.extractfile('package/esbuild.exe').read())
print('Pinned esbuild prepared')
