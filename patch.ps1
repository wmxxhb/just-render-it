[CmdletBinding()]
param(
    [ValidateSet('Install', 'Uninstall', 'Check')][string]$Action = 'Check',
    [string]$TyporaPath,
    [string]$OriginalBackupPath
)

# This script is distributed as UTF-8 with BOM for Windows PowerShell 5.1.
Set-StrictMode -Version 2
$ErrorActionPreference = 'Stop'
$Utf8 = New-Object System.Text.UTF8Encoding($false, $true)
$Manifest = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'payload\patches.json') -Raw -Encoding UTF8 | ConvertFrom-Json

function Hash-Bytes([byte[]]$Bytes) {
    $sha = [Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($sha.ComputeHash($Bytes))).Replace('-', '').ToLowerInvariant() }
    finally { $sha.Dispose() }
}
function Child-Path([string]$Base, [string]$Relative) {
    $baseFull = [IO.Path]::GetFullPath($Base).TrimEnd('\') + '\'
    $full = [IO.Path]::GetFullPath((Join-Path $Base $Relative))
    if (-not $full.StartsWith($baseFull, [StringComparison]::OrdinalIgnoreCase)) { throw '补丁路径越出了目标目录。' }
    return $full
}
function Resolve-Resources([string]$InputPath) {
    if (-not $InputPath) { return $null }
    $p = [Environment]::ExpandEnvironmentVariables($InputPath.Trim().Trim('"'))
    if (-not (Test-Path -LiteralPath $p)) { return $null }
    $p = (Get-Item -LiteralPath $p).FullName
    if (Test-Path -LiteralPath $p -PathType Leaf) { $p = Split-Path -Parent $p }
    foreach ($candidate in @($p, (Join-Path $p 'resources'))) {
        if ((Test-Path -LiteralPath (Join-Path $candidate 'window.html')) -and
            (Test-Path -LiteralPath (Join-Path $candidate 'package.json'))) { return $candidate }
    }
    return $null
}
function Find-Resources {
    if ($TyporaPath) {
        $found = Resolve-Resources $TyporaPath
        if (-not $found) { throw '找不到 Typora。请传入 Typora.exe、安装目录或 resources 目录。' }
        return $found
    }
    $candidates = New-Object 'System.Collections.Generic.List[string]'
    foreach ($process in @(Get-Process -Name Typora -ErrorAction SilentlyContinue)) {
        try { if ($process.Path) { $candidates.Add($process.Path) } } catch {}
    }
    foreach ($key in @(
        'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
        'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
        'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*'
    )) {
        foreach ($entry in @(Get-ItemProperty -Path $key -ErrorAction SilentlyContinue)) {
            if ($entry.PSObject.Properties['DisplayName'] -and $entry.DisplayName -like '*Typora*') {
                if ($entry.PSObject.Properties['InstallLocation'] -and $entry.InstallLocation) { $candidates.Add($entry.InstallLocation) }
                if ($entry.PSObject.Properties['DisplayIcon'] -and $entry.DisplayIcon) {
                    $candidates.Add(($entry.DisplayIcon -replace ',\d+$', '').Trim('"'))
                }
            }
        }
    }
    foreach ($base in @($env:ProgramFiles, ${env:ProgramFiles(x86)}, $env:LOCALAPPDATA)) {
        if ($base) { $candidates.Add((Join-Path $base 'Typora')); $candidates.Add((Join-Path $base 'Programs\Typora')) }
    }
    $foundPaths = @($candidates | ForEach-Object { Resolve-Resources $_ } | Where-Object { $_ } | Select-Object -Unique)
    if ($foundPaths.Count -eq 1) { return $foundPaths[0] }
    if ($foundPaths.Count -gt 1) { Write-Host ('检测到多个安装目录：' + ($foundPaths -join '；')) }
    $answer = Read-Host '请输入要处理的 Typora.exe 完整路径（可粘贴安装目录）'
    $found = Resolve-Resources $answer
    if (-not $found) { throw '找不到指定的 Typora 安装目录。' }
    return $found
}
function Assert-Closed {
    $exe = Join-Path (Split-Path -Parent $Resources) 'Typora.exe'
    foreach ($process in @(Get-Process -Name Typora -ErrorAction SilentlyContinue)) {
        $runningPath = $null
        try { $runningPath = $process.Path } catch {}
        if ((-not $runningPath) -or [string]::Equals($runningPath, $exe, [StringComparison]::OrdinalIgnoreCase)) {
            throw '请保存文档并完全退出此 Typora，然后重新运行。脚本不会强制关闭应用。'
        }
    }
}
function Write-Atomic([string]$Path, [byte[]]$Bytes) {
    $parent = Split-Path -Parent $Path
    [IO.Directory]::CreateDirectory($parent) | Out-Null
    $temp = $Path + '.math-compat-' + [Guid]::NewGuid().ToString('N') + '.tmp'
    try {
        [IO.File]::WriteAllBytes($temp, $Bytes)
        if ([IO.File]::Exists($Path)) { [IO.File]::Replace($temp, $Path, [NullString]::Value) }
        else { [IO.File]::Move($temp, $Path) }
    } finally {
        if ([IO.File]::Exists($temp)) { [IO.File]::Delete($temp) }
    }
}
function Backup-Valid {
    foreach ($file in $Files) {
        $p = Child-Path $Backup $file.Relative
        if (-not [IO.File]::Exists($p)) { return $false }
        if ((Hash-Bytes ([IO.File]::ReadAllBytes($p))) -ne $file.OriginalHash) { return $false }
    }
    return $true
}
function Ensure-Backup([bool]$FromOriginal) {
    if (Backup-Valid) { return }
    # Check every existing backup before writing any backup file.
    $copies = @()
    foreach ($file in $Files) {
        $p = Child-Path $Backup $file.Relative
        if ([IO.File]::Exists($p) -and (Hash-Bytes ([IO.File]::ReadAllBytes($p))) -ne $file.OriginalHash) {
            throw ('已有备份校验失败，未覆盖：' + $p)
        }
        if ($FromOriginal) { $bytes = $file.Bytes }
        elseif ($OriginalBackupPath) {
            $source = Child-Path $OriginalBackupPath $file.Relative
            $bytes = [IO.File]::ReadAllBytes($source)
        } else { throw '已安装补丁但缺少本地原版备份。可用 -OriginalBackupPath 指定以前保存的原始文件备份目录。' }
        if ((Hash-Bytes $bytes) -ne $file.OriginalHash) { throw ('原始备份内容不匹配：' + $file.Relative) }
        $copies += [PSCustomObject]@{ Path = $p; Bytes = $bytes }
    }
    foreach ($copy in $copies) { Write-Atomic $copy.Path $copy.Bytes }
    if (-not (Backup-Valid)) { throw '原版备份未通过校验，停止安装。' }
}
function Commit-Changes($Changes) {
    $completed = @()
    try {
        foreach ($change in $Changes) {
            # Include the current write in recovery even if replacement fails mid-call.
            $completed += $change
            if ($null -eq $change.New) { [IO.File]::Delete($change.Path) }
            else { Write-Atomic $change.Path $change.New }
        }
        foreach ($change in $Changes) {
            if ($null -eq $change.New) {
                if ([IO.File]::Exists($change.Path)) { throw '卸载文件核验失败。' }
            } elseif ((Hash-Bytes ([IO.File]::ReadAllBytes($change.Path))) -ne (Hash-Bytes $change.New)) {
                throw '写入后的文件校验失败。'
            }
        }
    } catch {
        $problem = $_.Exception.Message
        $recoveryErrors = @()
        [array]::Reverse($completed)
        foreach ($change in $completed) {
            try {
                if ($null -eq $change.Old) { [IO.File]::Delete($change.Path) }
                elseif (-not [IO.File]::Exists($change.Path) -or
                    (Hash-Bytes ([IO.File]::ReadAllBytes($change.Path))) -ne (Hash-Bytes $change.Old)) {
                    Write-Atomic $change.Path $change.Old
                }
            } catch { $recoveryErrors += $_.Exception.Message }
        }
        if ($recoveryErrors.Count) { throw ($problem + '；自动恢复未完全成功，请保留备份目录：' + $Backup + '；' + ($recoveryErrors -join '；')) }
        throw ($problem + '；本次文件修改已自动撤回。')
    }
}

try {
    $Resources = Find-Resources
    $package = [IO.File]::ReadAllText((Join-Path $Resources 'package.json'), $Utf8) | ConvertFrom-Json
    if ($package.name -ne 'Typora' -or $package.version -ne $Manifest.typora_version) {
        throw ('本补丁仅适用于已验证的 Typora ' + $Manifest.typora_version + '。当前版本：' + $package.version)
    }
    $Files = @()
    foreach ($prop in $Manifest.files.PSObject.Properties) {
        $path = Child-Path $Resources $prop.Name
        $bytes = [IO.File]::ReadAllBytes($path)
        $Files += [PSCustomObject]@{
            Relative = $prop.Name; Path = $path; Bytes = $bytes; Hash = (Hash-Bytes $bytes)
            OriginalHash = $prop.Value.original_sha256; PatchedHash = $prop.Value.patched_sha256
        }
    }
    $isOriginal = @($Files | Where-Object { $_.Hash -ne $_.OriginalHash }).Count -eq 0
    $isPatched = @($Files | Where-Object { $_.Hash -ne $_.PatchedHash }).Count -eq 0
    if (-not $isOriginal -and -not $isPatched) { throw '程序文件与已验证的原版或 v2 补丁不匹配，已停止，未修改文件。' }
    $Helper = Child-Path $Resources 'modu-math-compat\compat.js'
    $Backup = Child-Path $Resources 'modu-math-compat-backup'
    $payload = [IO.File]::ReadAllBytes((Join-Path $PSScriptRoot 'payload\compat.js'))
    if ((Hash-Bytes $payload) -ne $Manifest.helper_sha256) { throw '补丁包内 compat.js 校验失败，请重新解压补丁包。' }
    $oldHelper = $null
    if ([IO.File]::Exists($Helper)) {
        $oldHelper = [IO.File]::ReadAllBytes($Helper)
        if ((Hash-Bytes $oldHelper) -ne $Manifest.helper_sha256) { throw '已有 compat.js 被改动，已停止以保留该文件。' }
    } elseif ($isPatched) { throw '已打补丁的程序缺少 compat.js，请保留备份并修复安装。' }
    Write-Host ('Typora ' + $package.version + '：' + $Resources)
    if ($Action -eq 'Check') {
        if ($isPatched) { Write-Host ('已安装公式兼容补丁 ' + $Manifest.patch_version + '，文件校验通过。') }
        else { Write-Host '原版程序，尚未安装此补丁。' }
        if (Backup-Valid) { Write-Host ('原版备份校验通过：' + $Backup) }
        else { Write-Host '此安装目录尚无完整、有效的本地原版备份。' }
    } elseif ($Action -eq 'Install') {
        if ($isPatched) {
            if ($OriginalBackupPath) { Ensure-Backup $false }
            Write-Host '已安装同一版本，无需重复修改程序。'
            if (-not (Backup-Valid)) { Write-Host '请继续保留此前的原始备份；本地备份迁移方法见使用说明。' }
            else { Write-Host ('原版备份校验通过：' + $Backup) }
        } else {
            Assert-Closed
            $changes = @()
            foreach ($file in $Files) {
                $source = $Utf8.GetString($file.Bytes)
                if ($file.Relative -eq 'window.html') {
                    $rules = @([PSCustomObject]@{
                        anchor = '<script src="./appsrc/window/frame.js" defer="defer"></script>'
                        replacement = '<script src="./modu-math-compat/compat.js"></script><script src="./appsrc/window/frame.js" defer="defer"></script>'
                        count = 1
                    })
                } else { $rules = $Manifest.patches }
                foreach ($rule in $rules) {
                    $count = 0; $at = 0
                    while (($at = $source.IndexOf($rule.anchor, $at, [StringComparison]::Ordinal)) -ge 0) { $count++; $at += $rule.anchor.Length }
                    if ($count -ne $rule.count) { throw ('补丁定位失败：' + $file.Relative + '，未修改程序。') }
                    $source = $source.Replace([string]$rule.anchor, [string]$rule.replacement)
                }
                $newBytes = $Utf8.GetBytes($source)
                if ((Hash-Bytes $newBytes) -ne $file.PatchedHash) { throw ('补丁生成校验失败：' + $file.Relative + '，未修改程序。') }
                $changes += [PSCustomObject]@{ Path = $file.Path; Old = $file.Bytes; New = $newBytes }
            }
            Ensure-Backup $true
            $changes += [PSCustomObject]@{ Path = $Helper; Old = $oldHelper; New = $payload }
            Commit-Changes $changes
            Write-Host ('安装成功。请重新启动 Typora。原版备份：' + $Backup)
        }
    } else {
        if ($isOriginal) { Write-Host '当前已经是原版程序，无需卸载。' }
        else {
            Assert-Closed
            if (-not (Backup-Valid) -and $OriginalBackupPath) { Ensure-Backup $false }
            if (-not (Backup-Valid)) { throw '缺少有效原版备份，未进行卸载。请按使用说明导入以前的原始备份。' }
            $changes = @()
            foreach ($file in $Files) {
                $changes += [PSCustomObject]@{ Path = $file.Path; Old = $file.Bytes; New = [IO.File]::ReadAllBytes((Child-Path $Backup $file.Relative)) }
            }
            $changes += [PSCustomObject]@{ Path = $Helper; Old = $oldHelper; New = $null }
            Commit-Changes $changes
            $helperDir = Split-Path -Parent $Helper
            if ([IO.Directory]::Exists($helperDir) -and [IO.Directory]::GetFileSystemEntries($helperDir).Length -eq 0) { [IO.Directory]::Delete($helperDir) }
            Write-Host ('卸载成功，已恢复原版程序。原版备份继续保留：' + $Backup)
        }
    }
    exit 0
} catch {
    Write-Host ('操作停止：' + $_.Exception.Message) -ForegroundColor Red
    exit 1
}
