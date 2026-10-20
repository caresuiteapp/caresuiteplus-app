# Ensures Git for Windows is on PATH for this PowerShell session (npm/EAS child processes).
# User PATH may already include Git; Cursor terminals started before PATH changes need a restart.
# Usage: . ./scripts/ensure-git-path.ps1

$gitCmd = Join-Path $env:LOCALAPPDATA 'Programs\Git\cmd'
$gitExe = Join-Path $gitCmd 'git.exe'

if (-not (Test-Path -LiteralPath $gitExe)) {
    Write-Warning "Git not found at $gitExe — install Git for Windows or adjust ensure-git-path.ps1."
    return
}

$pathParts = $env:Path -split ';' | Where-Object { $_ -and $_.Trim() -ne '' }
if ($pathParts -notcontains $gitCmd) {
    $env:Path = "$gitCmd;" + $env:Path
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Warning "git.exe still not resolvable after updating session PATH."
}
