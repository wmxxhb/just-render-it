"""Build a small offline distribution from an explicit, public-only file list."""
from pathlib import Path
import hashlib
import json
import zipfile

ROOT=Path(__file__).resolve().parents[1]
FILES=['README.md','使用说明.md','示例.md','LICENSE.txt','CHANGELOG.md','docs/development.md','安装.cmd','卸载.cmd','检查.cmd','patch.ps1','payload/compat.js','payload/patches.json']
manifest=json.loads((ROOT/'payload/patches.json').read_text(encoding='utf-8'))
version=manifest['patch_version']
if version!='2.0.0':raise SystemExit('Review the release file list and documentation before changing the version.')
contents={name:(ROOT/name).read_bytes() for name in FILES}
# Match Git's canonical LF for docs/data regardless of the local checkout.
for name in FILES:
    if name!='payload/compat.js' and name!='patch.ps1' and not name.endswith('.cmd'):
        contents[name]=contents[name].replace(b'\r\n',b'\n')
assert hashlib.sha256(contents['payload/compat.js']).hexdigest()==manifest['helper_sha256'],'Helper checksum mismatch'
assert contents['patch.ps1'].startswith(b'\xef\xbb\xbf'),'Windows PowerShell 5.1 requires UTF-8 BOM for Chinese text'
for name in ['安装.cmd','卸载.cmd','检查.cmd']:
    assert b'\r\n' in contents[name] and b'\n' not in contents[name].replace(b'\r\n',b''),'CMD files require CRLF'
contents['SHA256SUMS.txt']=''.join(hashlib.sha256(data).hexdigest()+'  '+name+'\n' for name,data in sorted(contents.items())).encode('utf-8')
folder='typora-math-compat-v'+version
output=ROOT/'dist'/(folder+'.zip')
output.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(output,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as archive:
    for name,data in sorted(contents.items()):
        entry=zipfile.ZipInfo(folder+'/'+name,date_time=(2026,1,1,0,0,0))
        entry.compress_type=zipfile.ZIP_DEFLATED
        entry.external_attr=0o100644<<16
        archive.writestr(entry,data,compresslevel=9)
with zipfile.ZipFile(output) as archive:
    assert archive.testzip() is None
    for name,data in contents.items():assert archive.read(folder+'/'+name)==data
print(output)
print('SHA256:',hashlib.sha256(output.read_bytes()).hexdigest())
