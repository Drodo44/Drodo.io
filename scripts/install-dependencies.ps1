[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$DrodoDir = Join-Path $env:APPDATA 'Drodo'
$LogFile = Join-Path $DrodoDir 'install.log'
$StatusFile = Join-Path $DrodoDir 'n8n-status.json'
$TempDir = Join-Path $env:TEMP 'DrodoBootstrap'
$N8nPort = 5678

New-Item -ItemType Directory -Path $DrodoDir -Force | Out-Null
New-Item -ItemType Directory -Path $TempDir -Force | Out-Null

function Write-Log {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Message
    )

    $line = '{0} {1}' -f (Get-Date).ToString('o'), $Message
    Add-Content -Path $LogFile -Value $line
}

function Save-Status {
    param(
        [Parameter(Mandatory = $true)]
        [bool]$Running,
        [Parameter(Mandatory = $true)]
        [int]$Port,
        [string]$StartedAt = ''
    )

    $normalizedStartedAt = $null
    if ($StartedAt) {
        $normalizedStartedAt = $StartedAt
    }

    $payload = [ordered]@{
        running   = $Running
        port      = $Port
        startedAt = $normalizedStartedAt
    }

    $payload | ConvertTo-Json | Set-Content -Path $StatusFile
}

function Refresh-ProcessPath {
    $machinePath = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
    $segments = @()

    foreach ($entry in @($machinePath, $userPath)) {
        if ([string]::IsNullOrWhiteSpace($entry)) {
            continue
        }

        foreach ($segment in $entry.Split(';', [System.StringSplitOptions]::RemoveEmptyEntries)) {
            $trimmed = $segment.Trim()
            if (-not $trimmed -or $segments -contains $trimmed) {
                continue
            }
            $segments += $trimmed
        }
    }

    $env:Path = $segments -join ';'
}

function Get-FirstExistingPath {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Candidates
    )

    foreach ($candidate in $Candidates) {
        if (-not [string]::IsNullOrWhiteSpace($candidate) -and (Test-Path -LiteralPath $candidate)) {
            return $candidate
        }
    }

    return $null
}

function Resolve-Executable {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$CommandNames,
        [string[]]$FallbackPaths = @()
    )

    foreach ($name in $CommandNames) {
        $command = Get-Command -Name $name -ErrorAction SilentlyContinue
        if ($command -and $command.Source) {
            return $command.Source
        }
    }

    if ($FallbackPaths.Count -eq 0) {
        return $null
    }

    return Get-FirstExistingPath -Candidates $FallbackPaths
}

function Get-NodeMajorVersion {
    param([string]$NodePath)

    if (-not $NodePath) {
        return $null
    }

    try {
        $raw = & $NodePath --version
        if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($raw)) {
            return $null
        }
        return ([version]($raw.Trim().TrimStart('v'))).Major
    } catch {
        return $null
    }
}

function Test-LocalPort {
    param(
        [Parameter(Mandatory = $true)]
        [int]$Port
    )

    $client = [System.Net.Sockets.TcpClient]::new()
    try {
        $async = $client.BeginConnect('127.0.0.1', $Port, $null, $null)
        if (-not $async.AsyncWaitHandle.WaitOne(1000, $false)) {
            return $false
        }
        $client.EndConnect($async)
        return $true
    } catch {
        return $false
    } finally {
        $client.Dispose()
    }
}

function Get-NodeInstallerInfo {
    $releases = Invoke-RestMethod -Uri 'https://nodejs.org/dist/index.json'
    $release = $releases |
        Where-Object { $_.lts -and $_.files -contains 'msi' } |
        Sort-Object { [version]($_.version.TrimStart('v')) } -Descending |
        Select-Object -First 1

    if (-not $release) {
        throw 'Unable to determine the latest Node.js LTS MSI package.'
    }

    $fileName = 'node-{0}-x64.msi' -f $release.version
    return @{
        Version = $release.version
        Url = 'https://nodejs.org/dist/{0}/{1}' -f $release.version, $fileName
        FileName = $fileName
    }
}

function Install-NodeLts {
    $installer = Get-NodeInstallerInfo
    $installerPath = Join-Path $TempDir $installer.FileName

    Write-Log "Downloading Node.js LTS $($installer.Version) from $($installer.Url)"
    Invoke-WebRequest -Uri $installer.Url -OutFile $installerPath

    Write-Log 'Installing Node.js silently.'
    $process = Start-Process -FilePath 'msiexec.exe' -ArgumentList @(
        '/i', "`"$installerPath`"",
        '/qn',
        '/norestart',
        'ALLUSERS=2',
        'MSIINSTALLPERUSER=1'
    ) -PassThru -Wait

    if ($process.ExitCode -ne 0) {
        throw "Node.js installer failed with exit code $($process.ExitCode)."
    }

    Refresh-ProcessPath
}

function Get-GitInstallerInfo {
    $release = Invoke-RestMethod -Uri 'https://api.github.com/repos/git-for-windows/git/releases/latest' -Headers @{
        'User-Agent' = 'DrodoInstaller'
        'Accept' = 'application/vnd.github+json'
    }

    $asset = $release.assets |
        Where-Object { $_.name -match '^Git-.*-64-bit\.exe$' } |
        Select-Object -First 1

    if (-not $asset) {
        throw 'Unable to determine the latest Git for Windows installer.'
    }

    return @{
        Version = $release.tag_name
        Url = $asset.browser_download_url
        FileName = $asset.name
    }
}

function Install-GitWindows {
    $installer = Get-GitInstallerInfo
    $installerPath = Join-Path $TempDir $installer.FileName

    Write-Log "Downloading Git for Windows $($installer.Version) from $($installer.Url)"
    Invoke-WebRequest -Uri $installer.Url -OutFile $installerPath

    Write-Log 'Installing Git silently.'
    $process = Start-Process -FilePath $installerPath -ArgumentList @(
        '/VERYSILENT',
        '/NORESTART',
        '/NOCANCEL',
        '/SP-',
        '/CURRENTUSER'
    ) -PassThru -Wait

    if ($process.ExitCode -ne 0) {
        throw "Git installer failed with exit code $($process.ExitCode)."
    }

    Refresh-ProcessPath
}

function Resolve-NodePath {
    return Resolve-Executable -CommandNames @('node.exe', 'node') -FallbackPaths @(
        (Join-Path $env:LOCALAPPDATA 'Programs\nodejs\node.exe'),
        (Join-Path $env:ProgramFiles 'nodejs\node.exe')
    )
}

function Resolve-NpmPath {
    $nodePath = Resolve-NodePath
    $nodeDir = ''
    if ($nodePath) {
        $nodeDir = Split-Path -Parent $nodePath
    }

    $fallbackPaths = @()
    if ($nodeDir) {
        $fallbackPaths += Join-Path $nodeDir 'npm.cmd'
    }
    $fallbackPaths += Join-Path $env:APPDATA 'npm\npm.cmd'

    return Resolve-Executable -CommandNames @('npm.cmd', 'npm') -FallbackPaths $fallbackPaths
}

function Resolve-GitPath {
    return Resolve-Executable -CommandNames @('git.exe', 'git') -FallbackPaths @(
        (Join-Path $env:LOCALAPPDATA 'Programs\Git\cmd\git.exe'),
        (Join-Path $env:ProgramFiles 'Git\cmd\git.exe'),
        (Join-Path ${env:ProgramFiles(x86)} 'Git\cmd\git.exe')
    )
}

function Ensure-NodeInstalled {
    $nodePath = Resolve-NodePath
    $major = Get-NodeMajorVersion -NodePath $nodePath

    if ($major -ge 18) {
        Write-Log "Node.js already available (major=$major)."
        return
    }

    Write-Log 'Node.js >= 18 not found. Installing Node.js LTS.'
    Install-NodeLts

    $nodePath = Resolve-NodePath
    $major = Get-NodeMajorVersion -NodePath $nodePath
    if ($major -lt 18) {
        throw 'Node.js installation completed, but Node.js >= 18 is still unavailable.'
    }

    Write-Log "Node.js installed successfully (major=$major)."
}

function Ensure-GitInstalled {
    $gitPath = Resolve-GitPath
    if ($gitPath) {
        Write-Log "Git already available at $gitPath."
        return
    }

    Write-Log 'Git not found. Installing Git for Windows.'
    Install-GitWindows

    $gitPath = Resolve-GitPath
    if (-not $gitPath) {
        throw 'Git installation completed, but git is still unavailable.'
    }

    Write-Log "Git installed successfully at $gitPath."
}

function Ensure-N8nInstalled {
    $npmPath = Resolve-NpmPath
    if (-not $npmPath) {
        throw 'npm is unavailable after Node.js installation.'
    }

    Write-Log 'Checking for a global n8n installation.'
    & $npmPath list -g n8n --depth=0 *> $null
    if ($LASTEXITCODE -eq 0) {
        Write-Log 'n8n is already installed globally.'
        return
    }

    Write-Log 'n8n not found globally. Installing with npm.'
    $maxAttempts = 3
    $retryDelaySeconds = 5
    $lastExitCode = 0

    for ($attempt = 1; $attempt -le $maxAttempts; $attempt += 1) {
        Write-Log "Installing n8n with npm (attempt $attempt of $maxAttempts)."
        & $npmPath install -g n8n --silent --prefer-offline --no-audit --no-fund
        $lastExitCode = $LASTEXITCODE
        if ($lastExitCode -ne 0) {
            Write-Log "npm install -g n8n attempt $attempt failed with exit code $lastExitCode."
            if ($attempt -lt $maxAttempts) {
                Start-Sleep -Seconds $retryDelaySeconds
            }
            continue
        }

        & $npmPath list -g n8n --depth=0 *> $null
        if ($LASTEXITCODE -ne 0) {
            throw 'npm reported n8n installed successfully, but n8n is still unavailable globally.'
        }

        Write-Log 'n8n installed successfully.'
        return
    }

    throw "npm install -g n8n failed after $maxAttempts attempts. Final exit code: $lastExitCode."
}

function Resolve-N8nPath {
    $n8nPath = Resolve-Executable -CommandNames @('n8n.cmd', 'n8n')
    if ($n8nPath) {
        return $n8nPath
    }

    $npmPath = Resolve-NpmPath
    if (-not $npmPath) {
        return $null
    }

    try {
        $prefix = (& $npmPath prefix -g).Trim()
        if (-not [string]::IsNullOrWhiteSpace($prefix)) {
            $fromPrefix = Join-Path $prefix 'n8n.cmd'
            if (Test-Path -LiteralPath $fromPrefix) {
                return $fromPrefix
            }
        }
    } catch {
        return $null
    }

    return $null
}

function Wait-ForN8n {
    param(
        [Parameter(Mandatory = $true)]
        [int]$Port
    )

    for ($attempt = 0; $attempt -lt 30; $attempt += 1) {
        if (Test-LocalPort -Port $Port) {
            return $true
        }

        Start-Sleep -Seconds 2
    }

    return $false
}

function Ensure-N8nRunning {
    if (Test-LocalPort -Port $N8nPort) {
        Write-Log "n8n is already listening on port $N8nPort."
        Save-Status -Running $true -Port $N8nPort -StartedAt (Get-Date).ToString('o')
        return
    }

    $n8nPath = Resolve-N8nPath
    if (-not $n8nPath) {
        throw 'n8n executable is unavailable after installation.'
    }

    Write-Log "Starting n8n in the background using $n8nPath."
    Start-Process -FilePath $n8nPath -ArgumentList @('start') -WindowStyle Hidden | Out-Null

    if (-not (Wait-ForN8n -Port $N8nPort)) {
        Save-Status -Running $false -Port $N8nPort
        throw "n8n did not become ready on port $N8nPort within the expected time."
    }

    $startedAt = (Get-Date).ToString('o')
    Save-Status -Running $true -Port $N8nPort -StartedAt $startedAt
    Write-Log "n8n is now listening on port $N8nPort."
}

try {
    Write-Log 'Starting Drodo dependency bootstrap.'
    Ensure-NodeInstalled
    Ensure-GitInstalled
    Ensure-N8nInstalled
    Ensure-N8nRunning
    Write-Log 'Drodo dependency bootstrap completed successfully.'
} catch {
    Write-Log "Drodo dependency bootstrap failed: $($_.Exception.Message)"
    Save-Status -Running $false -Port $N8nPort
    exit 1
}
