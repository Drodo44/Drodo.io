[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Test-IsAdministrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = [Security.Principal.WindowsPrincipal]::new($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Restart-Elevated {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ScriptPath
    )

    $argList = @(
        '-NoProfile'
        '-ExecutionPolicy', 'Bypass'
        '-File', ('"{0}"' -f $ScriptPath)
    )

    $process = Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList $argList -Wait -PassThru
    exit $process.ExitCode
}

function Ensure-Directory {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        New-Item -ItemType Directory -Path $Path -Force | Out-Null
    }
}

function Invoke-RoboMove {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Source,
        [Parameter(Mandatory = $true)]
        [string]$Destination
    )

    Ensure-Directory -Path $Destination

    $arguments = @(
        $Source
        $Destination
        '/E'
        '/MOVE'
        '/R:2'
        '/W:1'
        '/NFL'
        '/NDL'
        '/NJH'
        '/NJS'
        '/NC'
        '/NS'
        '/NP'
    )

    $null = & robocopy @arguments
    $exitCode = $LASTEXITCODE

    if ($exitCode -gt 7) {
        throw "robocopy failed moving '$Source' to '$Destination' with exit code $exitCode."
    }

    if (Test-Path -LiteralPath $Source) {
        $remaining = Get-ChildItem -LiteralPath $Source -Force -ErrorAction SilentlyContinue
        if (-not $remaining) {
            Remove-Item -LiteralPath $Source -Force -Recurse -ErrorAction SilentlyContinue
        }
    }
}

function Move-IfPresent {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Source,
        [Parameter(Mandatory = $true)]
        [string]$Destination
    )

    if (-not (Test-Path -LiteralPath $Source)) {
        Write-Host "Skipping missing path: $Source"
        Ensure-Directory -Path $Destination
        return
    }

    Write-Host "Moving $Source -> $Destination"
    Invoke-RoboMove -Source $Source -Destination $Destination
}

function Get-NormalizedPathList {
    param(
        [AllowEmptyString()]
        [string]$Value
    )

    if ([string]::IsNullOrWhiteSpace($Value)) {
        return @()
    }

    return $Value.Split(';', [System.StringSplitOptions]::RemoveEmptyEntries) |
        ForEach-Object { $_.Trim() } |
        Where-Object { $_ }
}

function Update-PathScope {
    param(
        [Parameter(Mandatory = $true)]
        [ValidateSet('Machine', 'User')]
        [string]$Scope,
        [Parameter(Mandatory = $true)]
        [string]$OldCargoBin,
        [Parameter(Mandatory = $true)]
        [string]$NewCargoBin,
        [switch]$AddNewPath
    )

    $current = [Environment]::GetEnvironmentVariable('Path', $Scope)
    $entries = Get-NormalizedPathList -Value $current

    $filtered = [System.Collections.Generic.List[string]]::new()
    foreach ($entry in $entries) {
        if ($entry.Equals($OldCargoBin, [System.StringComparison]::OrdinalIgnoreCase)) {
            continue
        }
        if ($entry.Equals($NewCargoBin, [System.StringComparison]::OrdinalIgnoreCase)) {
            continue
        }
        $filtered.Add($entry)
    }

    if ($AddNewPath.IsPresent) {
        $filtered.Add($NewCargoBin)
    }

    [Environment]::SetEnvironmentVariable('Path', ($filtered -join ';'), $Scope)
}

function Refresh-ProcessPath {
    $machinePath = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
    $combined = @()

    foreach ($entry in (Get-NormalizedPathList -Value $machinePath) + (Get-NormalizedPathList -Value $userPath)) {
        if ($combined -contains $entry) {
            continue
        }
        $combined += $entry
    }

    $env:Path = $combined -join ';'
}

if (-not (Test-IsAdministrator)) {
    Restart-Elevated -ScriptPath $PSCommandPath
}

$userProfile = [Environment]::GetFolderPath('UserProfile')
$sourceRustup = Join-Path $userProfile '.rustup'
$sourceCargo = Join-Path $userProfile '.cargo'
$destinationRoot = 'A:\Rust'
$destinationRustup = Join-Path $destinationRoot 'rustup'
$destinationCargo = Join-Path $destinationRoot 'cargo'
$oldCargoBin = Join-Path $sourceCargo 'bin'
$newCargoBin = Join-Path $destinationCargo 'bin'

Write-Host 'Ensuring target directories exist...'
Ensure-Directory -Path $destinationRoot

Move-IfPresent -Source $sourceRustup -Destination $destinationRustup
Move-IfPresent -Source $sourceCargo -Destination $destinationCargo

Write-Host 'Setting machine environment variables...'
[Environment]::SetEnvironmentVariable('RUSTUP_HOME', $destinationRustup, 'Machine')
[Environment]::SetEnvironmentVariable('CARGO_HOME', $destinationCargo, 'Machine')

Write-Host 'Updating PATH...'
Update-PathScope -Scope 'Machine' -OldCargoBin $oldCargoBin -NewCargoBin $newCargoBin -AddNewPath
Update-PathScope -Scope 'User' -OldCargoBin $oldCargoBin -NewCargoBin $newCargoBin

$env:RUSTUP_HOME = $destinationRustup
$env:CARGO_HOME = $destinationCargo
Refresh-ProcessPath

Write-Host ''
Write-Host 'Verification: rustup show'
& rustup show
if ($LASTEXITCODE -ne 0) {
    throw "rustup show failed with exit code $LASTEXITCODE."
}

Write-Host ''
Write-Host 'Verification: cargo --version'
& cargo --version
if ($LASTEXITCODE -ne 0) {
    throw "cargo --version failed with exit code $LASTEXITCODE."
}

Write-Host ''
Write-Host 'Rust homes moved and environment updated successfully.'
