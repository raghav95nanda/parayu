"""Assemble a dependency-free GitHub Pages site from app/ and audio-packs/."""
import base64, hashlib, json, os, shutil, zipfile
from urllib.parse import urlsplit
from pathlib import Path,PurePosixPath
ROOT=Path(__file__).resolve().parents[1]; OUT=ROOT/'dist'
if OUT.exists():shutil.rmtree(OUT)
shutil.copytree(ROOT/'app',OUT)

# Both values are intentionally public at runtime. Reject private keys at build time.
project_url = os.getenv('PARAYU_SUPABASE_URL', '').strip().rstrip('/')
publishable_key = os.getenv('PARAYU_SUPABASE_PUBLISHABLE_KEY', '').strip()
if bool(project_url) != bool(publishable_key):
    raise SystemExit('Set both PARAYU_SUPABASE_URL and PARAYU_SUPABASE_PUBLISHABLE_KEY, or leave both empty for guest mode.')
if project_url:
    url = urlsplit(project_url)
    if url.scheme != 'https' or not url.hostname or url.username or url.password or url.path or url.query or url.fragment:
        raise SystemExit('PARAYU_SUPABASE_URL must be the HTTPS project origin.')
    if not (publishable_key.startswith('sb_publishable_') and len(publishable_key) > len('sb_publishable_')):
        try:
            _, payload, _ = publishable_key.split('.')
            if json.loads(base64.urlsafe_b64decode(payload + '=' * (-len(payload) % 4)))['role'] != 'anon':
                raise ValueError('Not a public anon key')
        except (ValueError, KeyError, TypeError):
            raise SystemExit('Use a Supabase publishable key or legacy anon key. Private keys must stay on the server.') from None
config = {'url': project_url, 'key': publishable_key} if project_url else None
(OUT/'parayu-config.js').write_text('window.PARAYU_SUPABASE = ' + json.dumps(config) + ';\n', encoding='utf-8')

sdk = ROOT/'node_modules/@supabase/supabase-js/dist/umd/supabase.js'
if not sdk.is_file():
    raise SystemExit('Run npm ci before building Parayu.')
(OUT/'vendor').mkdir()
shutil.copy2(sdk, OUT/'vendor/supabase.js')

for archive in sorted((ROOT/'audio-packs').glob('audio-*.zip')):
    with zipfile.ZipFile(archive) as z:
        for name in z.namelist():
            path=PurePosixPath(name)
            if path.is_absolute() or '..' in path.parts or path.parts[0]!='audio':raise ValueError('Unsafe audio pack member')
        z.extractall(OUT)
index=json.loads((OUT/'offline-audio-index.json').read_text())
assert len(index['files'])==index['count']==2290
assert len(set(index['files']))==index['count']
assert sum((OUT/name).stat().st_size for name in index['files'])==index['bytes']
assert all((OUT/name).is_file() for name in index['files'])
# A source change automatically creates a fresh shell cache on the next visit.
hash=hashlib.sha256()
for p in sorted((ROOT/'app').rglob('*')):
    if p.is_file():hash.update(str(p.relative_to(ROOT/'app')).encode());hash.update(p.read_bytes())
hash.update((OUT/'parayu-config.js').read_bytes())
hash.update(sdk.read_bytes())
version=hash.hexdigest()[:12]
p=OUT/'sw.js';p.write_text(p.read_text().replace('__PARAYU_BUILD__',version))
print(f'Built dist/: 144 phrases, 1,000 words, {index["count"]} audio clips. Shell version {version}.')
