from pathlib import Path
import argparse, hashlib, json, shutil, subprocess, sys, tempfile

root = Path(__file__).resolve().parents[1]
pkg = root
parser = argparse.ArgumentParser(description='Test on private copies without modifying the supplied originals.')
parser.add_argument('--original-resources', required=True, type=Path)
args = parser.parse_args()
original = args.original_resources.resolve()
test = Path(tempfile.mkdtemp(prefix='typora-math-compat-test-'))
print('Temporary fixtures (retained for inspection):', test)
manifest = json.loads((pkg / 'payload/patches.json').read_text(encoding='utf-8'))
ps = str(Path(__import__('os').environ.get('SystemRoot', r'C:\Windows')) / 'System32/WindowsPowerShell/v1.0/powershell.exe')
results = []

for rel, info in manifest['files'].items():
    assert hashlib.sha256((original/rel).read_bytes()).hexdigest() == info['original_sha256'], 'Original fixture hash mismatch: '+rel

def digest(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def snapshot(folder): return {str(p.relative_to(folder)): digest(p) for p in folder.rglob('*') if p.is_file()}
def fixture(name):
    res = test / name / 'resources'
    assert not res.exists(), 'Choose a fresh fixture name: '+name
    for rel in manifest['files']:
        dest=res/rel; dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(original/rel,dest)
    (res/'package.json').write_text('{"name":"Typora","version":"1.2.4"}',encoding='utf-8')
    return res
def run(action, res, expected=0, extra=()):
    cmd=[ps,'-NoProfile','-ExecutionPolicy','Bypass','-File',str(pkg/'patch.ps1'),'-Action',action,'-TyporaPath',str(res),*extra]
    out=subprocess.run(cmd,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=60)
    if out.returncode!=expected:
        print(out.stdout.decode('utf-8',errors='replace'))
        raise AssertionError(f'{action}: exit {out.returncode}, expected {expected}')
    return out
def record(name): results.append(name); print('PASS',name)

res=fixture('roundtrip')
before=snapshot(res)
run('Check',res); assert snapshot(res)==before
record('Read-only check leaves original files unchanged')
run('Install',res)
for rel,info in manifest['files'].items():
    assert digest(res/rel)==info['patched_sha256']
    assert digest(res/'modu-math-compat-backup'/rel)==info['original_sha256']
assert digest(res/'modu-math-compat/compat.js')==manifest['helper_sha256']
record('Install produces byte-identical verified v2 and original backups')
installed=snapshot(res)
run('Install',res); assert snapshot(res)==installed
run('Check',res); assert snapshot(res)==installed
record('Repeated install and status check do not change installed files')
run('Uninstall',res)
for rel,info in manifest['files'].items(): assert digest(res/rel)==info['original_sha256']
assert not (res/'modu-math-compat/compat.js').exists()
assert (res/'modu-math-compat-backup/window.html').exists()
record('Uninstall restores exact originals and removes active helper, preserving backups')
uninstalled=snapshot(res)
run('Uninstall',res); assert snapshot(res)==uninstalled
run('Install',res); assert snapshot(res)==installed
record('Repeated uninstall is harmless; reinstall reuses verified backups')

adopt=fixture('adopt')
for rel in manifest['files']: shutil.copyfile(res/rel,adopt/rel)
dest=adopt/'modu-math-compat/compat.js';dest.parent.mkdir();shutil.copyfile(pkg/'payload/compat.js',dest)
patched_hashes={rel:digest(adopt/rel) for rel in manifest['files']}
run('Install',adopt,extra=['-OriginalBackupPath',str(original)])
assert patched_hashes=={rel:digest(adopt/rel) for rel in manifest['files']}
run('Uninstall',adopt)
for rel,info in manifest['files'].items():assert digest(adopt/rel)==info['original_sha256']
record('Importing original backups supports the already-installed v2 without rewriting runtime files')

wrong=fixture('wrong-version');(wrong/'package.json').write_text('{"name":"Typora","version":"1.2.5"}',encoding='utf-8')
before=snapshot(wrong);run('Install',wrong,1);assert snapshot(wrong)==before
record('Unsupported Typora version is rejected without changes')
changed=fixture('changed-file');(changed/'window.html').write_bytes((changed/'window.html').read_bytes()+b'\n<!-- custom edit -->')
before=snapshot(changed);run('Install',changed,1);assert snapshot(changed)==before
record('Modified program files are rejected without changes')
broken=fixture('broken-backup');b=broken/'modu-math-compat-backup/window.html';b.parent.mkdir();b.write_bytes(b'bad backup')
before=snapshot(broken);run('Install',broken,1);assert snapshot(broken)==before
record('Existing damaged backup is preserved and installation stops before writing program files')

missing=fixture('missing-backup')
for rel in manifest['files']:shutil.copyfile(res/rel,missing/rel)
h=missing/'modu-math-compat/compat.js';h.parent.mkdir();shutil.copyfile(pkg/'payload/compat.js',h)
before=snapshot(missing);run('Uninstall',missing,1);assert snapshot(missing)==before
record('Uninstall without original backup refuses without changes')
h.write_bytes(h.read_bytes()+b'\n// modification')
before=snapshot(missing);run('Install',missing,1);assert snapshot(missing)==before
record('Modified helper is preserved and rejected')

# Hold the second destination open without write-sharing: the first replacement
# must be rolled back when the second cannot be replaced.
locked=fixture('locked-write')
lock_script=test/'lock.ps1'
lock_script.write_text('''param([string]$Target,[string]$Patch,[string]$Resources)
$handle = [IO.File]::Open($Target,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
try { & $Patch -Action Install -TyporaPath $Resources } finally { $handle.Dispose() }
exit $LASTEXITCODE
''',encoding='utf-8-sig')
out=subprocess.run([ps,'-NoProfile','-ExecutionPolicy','Bypass','-File',str(lock_script),'-Target',str(locked/'appsrc/window/frame.js'),'-Patch',str(pkg/'patch.ps1'),'-Resources',str(locked)],stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=60)
assert out.returncode==1,out.stdout.decode('utf-8',errors='replace')
for rel,info in manifest['files'].items(): assert digest(locked/rel)==info['original_sha256']
assert not (locked/'modu-math-compat/compat.js').exists()
record('Second-file write failure restores the first file; original program remains intact')

(test/'results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
print(f'All {len(results)} packaging checks passed under Windows PowerShell 5.1.')
