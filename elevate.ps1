# Called by patch.bat: re-launch this script via an elevated cmd.exe.
# Keep this file ASCII. Compatible with Windows PowerShell 5.1
# (Start-Process -LiteralPath is PowerShell 6+ only).
$ErrorActionPreference = 'Stop'
$bat = $env:SEE_PATCH_SELF
if (-not $bat) { throw 'SEE_PATCH_SELF is empty' }
if (-not [System.IO.File]::Exists($bat)) { throw "patch.bat not found: $bat" }

$wd = [System.IO.Path]::GetDirectoryName($bat)
$cmd = $env:ComSpec
if (-not $cmd) { $cmd = [Environment]::GetEnvironmentVariable('ComSpec') }
if (-not $cmd) { $cmd = Join-Path $env:SystemRoot 'System32\cmd.exe' }
$arg = '/c call "' + $bat + '"'
try {
    Start-Process -FilePath $cmd -Verb RunAs -WorkingDirectory $wd -ArgumentList $arg
} catch {
    $msg = [string]$_.Exception.Message
    if ($msg -match 'canceled|cancelled|\u88AB\u7528\u6237|\u53D6\u6D88') {
        exit 2
    }
    throw
}
