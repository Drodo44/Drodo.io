[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$RepoOwner = 'Drodo44'
$RepoName = 'Drodo.io'
$RequiredFreeSpaceBytes = 5GB
$N8nPort = 5678
$N8nUrl = "http://127.0.0.1:$N8nPort"
$N8nReadyUrl = "$N8nUrl/healthz/readiness"
$N8nReadyProbeTimeoutSeconds = 5
$N8nStartupTimeoutSeconds = 600
$N8nStartupProbeIntervalSeconds = 5

function Resolve-AutomationHome {
    if ($env:DRODO_AUTOMATION_HOME) {
        return [System.IO.Path]::GetFullPath($env:DRODO_AUTOMATION_HOME)
    }

    $parentDir = Split-Path -Parent $PSScriptRoot
    if ((Split-Path -Leaf $parentDir) -ieq '_up_') {
        return Join-Path (Split-Path -Parent $parentDir) 'automation'
    }

    return Join-Path (Split-Path -Parent $PSScriptRoot) '.automation\windows'
}

function Get-RepoRoot {
    return Split-Path -Parent $PSScriptRoot
}

$AutomationHome = Resolve-AutomationHome
$AutomationLogsDir = Join-Path $AutomationHome 'logs'
$AutomationDownloadsDir = Join-Path $AutomationHome 'downloads'
$AutomationTempDir = Join-Path $AutomationHome 'tmp'
$AutomationDataDir = Join-Path $AutomationHome 'data'
$StatusFile = Join-Path $AutomationHome 'n8n-status.json'
$LastErrorFile = Join-Path $AutomationHome 'last-error.txt'
$LogFile = Join-Path $AutomationLogsDir 'bootstrap.log'
$RuntimeLogFile = Join-Path $AutomationLogsDir 'n8n-runtime.out.log'
$RuntimeErrorLogFile = Join-Path $AutomationLogsDir 'n8n-runtime.err.log'
$ManifestPath = Join-Path $AutomationHome 'manifest.json'

New-Item -ItemType Directory -Path $AutomationLogsDir -Force | Out-Null
New-Item -ItemType Directory -Path $AutomationDownloadsDir -Force | Out-Null
New-Item -ItemType Directory -Path $AutomationTempDir -Force | Out-Null

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
        [string]$StartedAt = '',
        [string]$ErrorCategory = '',
        [string]$ErrorMessage = ''
    )

    $payload = [ordered]@{
        running            = $Running
        url                = $N8nUrl
        port               = $N8nPort
        startedAt          = $(if ($StartedAt) { $StartedAt } else { $null })
        logPath            = $LogFile
        runtimeLogPath     = $RuntimeLogFile
        runtimeErrorLogPath = $RuntimeErrorLogFile
        errorCategory      = $(if ($ErrorCategory) { $ErrorCategory } else { $null })
        errorMessage       = $(if ($ErrorMessage) { $ErrorMessage } else { $null })
    }

    $payload | ConvertTo-Json | Set-Content -Path $StatusFile
}

function Save-LastError {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Category,
        [Parameter(Mandatory = $true)]
        [string]$Message
    )

    Set-Content -Path $LastErrorFile -Value @(
        $Category
        $Message
        $LogFile
    )
}

function Clear-LastError {
    if (Test-Path -LiteralPath $LastErrorFile) {
        Remove-Item -LiteralPath $LastErrorFile -Force
    }
}

function Get-InstallRoot {
    return Split-Path -Parent $AutomationHome
}

function Read-VersionFromJson {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        return ''
    }

    try {
        return (Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json).version
    } catch {
        return ''
    }
}

function Resolve-AppVersion {
    if ($env:DRODO_APP_VERSION) {
        return $env:DRODO_APP_VERSION
    }

    foreach ($candidate in @(
        (Join-Path (Get-RepoRoot) 'src-tauri\tauri.conf.json'),
        (Join-Path (Get-RepoRoot) 'package.json')
    )) {
        $version = Read-VersionFromJson -Path $candidate
        if ($version) {
            return $version
        }
    }

    $installRoot = Get-InstallRoot
    foreach ($candidate in @(
        (Join-Path $installRoot 'Drodo.exe'),
        (Join-Path $installRoot 'tauri-app.exe')
    )) {
        if (-not (Test-Path -LiteralPath $candidate)) {
            continue
        }

        $version = (Get-Item -LiteralPath $candidate).VersionInfo.ProductVersion
        if (-not $version) {
            $version = (Get-Item -LiteralPath $candidate).VersionInfo.FileVersion
        }

        if ($version -match '\d+\.\d+\.\d+') {
            return $Matches[0]
        }
    }

    throw 'Unable to determine the Drodo application version for runtime bootstrap.'
}

$AppVersion = Resolve-AppVersion
$ExpectedPlatform = 'windows-x64'
$RuntimeAssetFileName = "drodo-runtime-$ExpectedPlatform-$AppVersion.zip"
$RuntimeChecksumFileName = "$RuntimeAssetFileName.sha256"

function Get-DefaultRuntimeBaseUrl {
    return "https://github.com/$RepoOwner/$RepoName/releases/download/v$AppVersion"
}

function Resolve-LocalRuntimeCandidate {
    if ($env:DRODO_AUTOMATION_RUNTIME_PATH -and (Test-Path -LiteralPath $env:DRODO_AUTOMATION_RUNTIME_PATH)) {
        return [System.IO.Path]::GetFullPath($env:DRODO_AUTOMATION_RUNTIME_PATH)
    }

    foreach ($candidate in @(
        (Join-Path (Get-RepoRoot) "artifacts\runtime\$RuntimeAssetFileName"),
        (Join-Path (Get-RepoRoot) '.cache\automation-runtime\windows\work\payload'),
        (Join-Path (Get-InstallRoot) "runtime-assets\$RuntimeAssetFileName"),
        (Join-Path $env:ProgramData "Drodo\runtime-assets\$RuntimeAssetFileName")
    )) {
        if ($candidate -and (Test-Path -LiteralPath $candidate)) {
            return [System.IO.Path]::GetFullPath($candidate)
        }
    }

    return ''
}

function Resolve-RuntimeAssetUrl {
    if ($env:DRODO_AUTOMATION_RUNTIME_URL) {
        return $env:DRODO_AUTOMATION_RUNTIME_URL
    }

    $baseUrl = Get-DefaultRuntimeBaseUrl
    if ($env:DRODO_RUNTIME_BASE_URL) {
        $baseUrl = $env:DRODO_RUNTIME_BASE_URL.TrimEnd('/')
    }

    return "$baseUrl/$RuntimeAssetFileName"
}

function Resolve-ChecksumUrl {
    return "$(Resolve-RuntimeAssetUrl).sha256"
}

function Get-ChecksumSidecarPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$AssetPath
    )

    return "$AssetPath.sha256"
}

function Get-InstallDriveInfo {
    $root = [System.IO.Path]::GetPathRoot($AutomationHome)
    if (-not $root) {
        throw "Unable to determine the install drive for automation home '$AutomationHome'."
    }

    return [System.IO.DriveInfo]::new($root)
}

function Ensure-SufficientDiskSpace {
    $driveInfo = Get-InstallDriveInfo
    if ($driveInfo.AvailableFreeSpace -lt $RequiredFreeSpaceBytes) {
        $availableGb = [math]::Round($driveInfo.AvailableFreeSpace / 1GB, 2)
        $requiredGb = [math]::Round($RequiredFreeSpaceBytes / 1GB, 2)
        throw "Insufficient disk space on install drive $($driveInfo.Name). Required ${requiredGb} GB free, found ${availableGb} GB."
    }
}

function Download-File {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Url,
        [Parameter(Mandatory = $true)]
        [string]$Destination
    )

    Write-Log "Downloading $Url to $Destination."

    $curl = Get-Command curl.exe -ErrorAction SilentlyContinue
    if ($null -ne $curl) {
        & $curl.Source '--fail' '--location' '--continue-at' '-' '--output' $Destination $Url
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to download $Url with curl.exe (exit code $LASTEXITCODE)."
        }
        return
    }

    Invoke-WebRequest -Uri $Url -OutFile $Destination -UseBasicParsing
}

function Get-ExpectedChecksum {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ChecksumPath
    )

    if (-not (Test-Path -LiteralPath $ChecksumPath)) {
        throw "Checksum file is missing at $ChecksumPath."
    }

    $content = (Get-Content -LiteralPath $ChecksumPath -Raw).Trim()
    if ($content -match '^([A-Fa-f0-9]{64})') {
        return $Matches[1].ToLowerInvariant()
    }

    throw "Checksum file at $ChecksumPath does not contain a valid SHA256 checksum."
}

function Verify-Checksum {
    param(
        [Parameter(Mandatory = $true)]
        [string]$FilePath,
        [Parameter(Mandatory = $true)]
        [string]$ChecksumPath
    )

    $expected = Get-ExpectedChecksum -ChecksumPath $ChecksumPath
    $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $FilePath).Hash.ToLowerInvariant()

    if ($expected -ne $actual) {
        throw "Checksum verification failed for $FilePath."
    }

    Write-Log "Checksum verification succeeded for $FilePath."
}

function Get-InstalledRuntimeManifest {
    if (-not (Test-Path -LiteralPath $ManifestPath)) {
        return $null
    }

    try {
        return Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
    } catch {
        return $null
    }
}

function Get-RequiredRuntimePaths {
    param(
        [Parameter(Mandatory = $true)]
        $Manifest
    )

    $paths = @()
    $paths += (Join-Path $AutomationHome $Manifest.paths.node)
    $paths += (Join-Path $AutomationHome $Manifest.paths.n8nCli)
    if ($Manifest.paths.git) {
        $paths += (Join-Path $AutomationHome $Manifest.paths.git)
    }
    return $paths
}

function Test-RuntimeInstalled {
    $manifest = Get-InstalledRuntimeManifest
    if ($null -eq $manifest) {
        return $false
    }

    if ($manifest.runtimeVersion -ne $AppVersion) {
        return $false
    }

    if ($manifest.platform -ne $ExpectedPlatform) {
        return $false
    }

    foreach ($path in Get-RequiredRuntimePaths -Manifest $manifest) {
        if (-not (Test-Path -LiteralPath $path)) {
            return $false
        }
    }

    return $true
}

function Copy-RuntimeTree {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Source,
        [Parameter(Mandatory = $true)]
        [string]$Destination
    )

    $robocopyLog = Join-Path $AutomationLogsDir 'robocopy-bootstrap.log'
    $null = & robocopy.exe $Source $Destination /E /R:2 /W:2 /NFL /NDL /NJH /NJS /NC /NS /NP /LOG:$robocopyLog
    if ($LASTEXITCODE -ge 8) {
        throw "Robocopy failed while materializing the runtime. See $robocopyLog for details."
    }
}

function Expand-RuntimeArchive {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ArchivePath,
        [Parameter(Mandatory = $true)]
        [string]$Destination
    )

    $tar = Get-Command tar.exe -ErrorAction SilentlyContinue
    if ($null -ne $tar) {
        & $tar.Source '-xf' $ArchivePath '-C' $Destination
        if ($LASTEXITCODE -eq 0) {
            return
        }
    }

    Expand-Archive -LiteralPath $ArchivePath -DestinationPath $Destination -Force
}

function Materialize-Runtime {
    param(
        [Parameter(Mandatory = $true)]
        [string]$SourcePath
    )

    $stagingDir = "${AutomationHome}.staging"
    $backupDir = "${AutomationHome}.backup"

    Remove-Item -LiteralPath $stagingDir -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $backupDir -Recurse -Force -ErrorAction SilentlyContinue
    New-Item -ItemType Directory -Path $stagingDir -Force | Out-Null

    $sourceItem = Get-Item -LiteralPath $SourcePath
    if ($sourceItem.PSIsContainer) {
        Write-Log "Copying runtime directory from $SourcePath to staging."
        Copy-RuntimeTree -Source $SourcePath -Destination $stagingDir
    } else {
        Write-Log "Extracting runtime archive $SourcePath to staging."
        Expand-RuntimeArchive -ArchivePath $SourcePath -Destination $stagingDir
    }

    if (Test-Path -LiteralPath $AutomationHome) {
        Move-Item -LiteralPath $AutomationHome -Destination $backupDir -Force
    }

    Move-Item -LiteralPath $stagingDir -Destination $AutomationHome -Force
    Remove-Item -LiteralPath $backupDir -Recurse -Force -ErrorAction SilentlyContinue

    New-Item -ItemType Directory -Path $AutomationLogsDir -Force | Out-Null
    New-Item -ItemType Directory -Path $AutomationDownloadsDir -Force | Out-Null
    New-Item -ItemType Directory -Path $AutomationTempDir -Force | Out-Null
}

function Resolve-DownloadTargets {
    $assetPath = Join-Path $AutomationDownloadsDir $RuntimeAssetFileName
    $checksumPath = Join-Path $AutomationDownloadsDir $RuntimeChecksumFileName
    return [ordered]@{
        asset = $assetPath
        checksum = $checksumPath
    }
}

function Resolve-RuntimeSource {
    $localCandidate = Resolve-LocalRuntimeCandidate
    if ($localCandidate) {
        Write-Log "Using local runtime source at $localCandidate."
        $checksumCandidate = Get-ChecksumSidecarPath -AssetPath $localCandidate
        return [ordered]@{
            source = $localCandidate
            checksum = $(if (Test-Path -LiteralPath $checksumCandidate) { $checksumCandidate } else { '' })
            downloaded = $false
        }
    }

    $targets = Resolve-DownloadTargets
    Download-File -Url (Resolve-RuntimeAssetUrl) -Destination $targets.asset
    Download-File -Url (Resolve-ChecksumUrl) -Destination $targets.checksum

    return [ordered]@{
        source = $targets.asset
        checksum = $targets.checksum
        downloaded = $true
    }
}

function Copy-DirectoryContents {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Source,
        [Parameter(Mandatory = $true)]
        [string]$Destination
    )

    New-Item -ItemType Directory -Path $Destination -Force | Out-Null
    foreach ($item in Get-ChildItem -LiteralPath $Source -Force) {
        Copy-Item -LiteralPath $item.FullName -Destination (Join-Path $Destination $item.Name) -Recurse -Force
    }
}

function Migrate-LegacyN8nData {
    if ((Get-ChildItem -LiteralPath $AutomationDataDir -Force -ErrorAction SilentlyContinue | Measure-Object).Count -gt 0) {
        return
    }

    foreach ($candidate in @(
        (Join-Path $env:USERPROFILE '.n8n'),
        (Join-Path $env:APPDATA 'n8n')
    )) {
        if (Test-Path -LiteralPath $candidate) {
            Write-Log "Migrating existing n8n data from $candidate to $AutomationDataDir."
            Copy-DirectoryContents -Source $candidate -Destination $AutomationDataDir
            return
        }
    }
}

function Ensure-RuntimeInstalled {
    Ensure-SufficientDiskSpace

    if (Test-RuntimeInstalled) {
        Migrate-LegacyN8nData
        Write-Log "Pinned automation runtime already present at $AutomationHome."
        return
    }

    $runtimeSource = Resolve-RuntimeSource
    if (-not (Get-Item -LiteralPath $runtimeSource.source).PSIsContainer) {
        if (-not $runtimeSource.checksum) {
            throw "A checksum file is required for runtime asset $($runtimeSource.source)."
        }
        Verify-Checksum -FilePath $runtimeSource.source -ChecksumPath $runtimeSource.checksum
    }

    Materialize-Runtime -SourcePath $runtimeSource.source
    Migrate-LegacyN8nData

    if (-not (Test-RuntimeInstalled)) {
        Remove-Item -LiteralPath $AutomationHome -Recurse -Force -ErrorAction SilentlyContinue
        throw 'Runtime installation completed, but the extracted runtime is incomplete or invalid.'
    }

    Write-Log "Pinned automation runtime is ready at $AutomationHome."
}

function Get-RuntimeManifest {
    $manifest = Get-InstalledRuntimeManifest
    if ($null -eq $manifest) {
        throw "Runtime manifest is missing or invalid at $ManifestPath."
    }
    return $manifest
}

function Get-NodePath {
    $manifest = Get-RuntimeManifest
    return Join-Path $AutomationHome $manifest.paths.node
}

function Get-GitPath {
    $manifest = Get-RuntimeManifest
    if (-not $manifest.paths.git) {
        return ''
    }
    return Join-Path $AutomationHome $manifest.paths.git
}

function Get-N8nCliPath {
    $manifest = Get-RuntimeManifest
    return Join-Path $AutomationHome $manifest.paths.n8nCli
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

function Get-ListeningProcessInfo {
    param(
        [Parameter(Mandatory = $true)]
        [int]$Port
    )

    $connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -First 1
    if (-not $connection) {
        return $null
    }

    return Get-CimInstance Win32_Process -Filter "ProcessId = $($connection.OwningProcess)" -ErrorAction SilentlyContinue
}

function Test-IsAutomationN8nProcess {
    param(
        [Parameter(Mandatory = $true)]
        $ProcessInfo
    )

    if ($null -eq $ProcessInfo) {
        return $false
    }

    $nodePath = Get-NodePath
    $n8nCliPath = Get-N8nCliPath

    $matchesNodePath = $false
    if ($ProcessInfo.ExecutablePath) {
        $matchesNodePath = $ProcessInfo.ExecutablePath -ieq $nodePath
    }

    $commandLine = ''
    if ($ProcessInfo.CommandLine) {
        $commandLine = $ProcessInfo.CommandLine
    }

    return $matchesNodePath -or
        ($commandLine -like "*$AutomationHome*") -or
        ($commandLine -like "*$n8nCliPath*")
}

function Stop-ListeningAutomationProcess {
    param(
        [Parameter(Mandatory = $true)]
        [int]$Port
    )

    $processInfo = Get-ListeningProcessInfo -Port $Port
    if ($null -eq $processInfo) {
        return
    }

    if (-not (Test-IsAutomationN8nProcess -ProcessInfo $processInfo)) {
        return
    }

    Write-Log "Stopping stale Drodo-owned n8n process $($processInfo.ProcessId) on port $Port."
    Stop-Process -Id $processInfo.ProcessId -Force -ErrorAction SilentlyContinue
}

function Test-N8nReady {
    try {
        $response = Invoke-WebRequest -Uri $N8nReadyUrl -UseBasicParsing -TimeoutSec $N8nReadyProbeTimeoutSeconds
        return $response.StatusCode -eq 200
    } catch {
        return $false
    }
}

function Wait-ForN8n {
    $maxAttempts = [math]::Ceiling($N8nStartupTimeoutSeconds / $N8nStartupProbeIntervalSeconds)
    for ($attempt = 0; $attempt -lt $maxAttempts; $attempt += 1) {
        if (Test-N8nReady) {
            return $true
        }
        Start-Sleep -Seconds $N8nStartupProbeIntervalSeconds
    }
    return $false
}

function Ensure-NodeAvailable {
    $nodePath = Get-NodePath
    if (-not (Test-Path -LiteralPath $nodePath)) {
        throw "Pinned Node.js executable is missing at $nodePath."
    }

    $raw = & $nodePath --version
    if ($LASTEXITCODE -ne 0) {
        throw "Pinned Node.js failed to execute from $nodePath."
    }

    Write-Log "Pinned Node.js available at $nodePath ($raw)."
}

function Ensure-GitAvailable {
    $gitPath = Get-GitPath
    if (-not $gitPath) {
        Write-Log 'Pinned Git is not included in this runtime.'
        return
    }

    if (-not (Test-Path -LiteralPath $gitPath)) {
        throw "Pinned Git executable is missing at $gitPath."
    }

    Write-Log "Pinned Git available at $gitPath."
}

function Ensure-N8nRunning {
    if (Test-N8nReady) {
        Write-Log "n8n is already healthy at $N8nReadyUrl."
        Save-Status -Running $true -StartedAt (Get-Date).ToString('o')
        return
    }

    $existingProcess = Get-ListeningProcessInfo -Port $N8nPort
    if ($null -ne $existingProcess) {
        if (Test-IsAutomationN8nProcess -ProcessInfo $existingProcess) {
            Write-Log "Detected existing Drodo-owned n8n process $($existingProcess.ProcessId) on port $N8nPort; waiting for readiness."
            if (Wait-ForN8n) {
                $startedAt = (Get-Date).ToString('o')
                Save-Status -Running $true -StartedAt $startedAt
                Write-Log "n8n is healthy at $N8nReadyUrl."
                return
            }

            Stop-ListeningAutomationProcess -Port $N8nPort
        } else {
            throw "Port $N8nPort is already in use by another process (PID $($existingProcess.ProcessId))."
        }
    }

    $nodePath = Get-NodePath
    $n8nCliPath = Get-N8nCliPath
    $gitPath = Get-GitPath

    if (-not (Test-Path -LiteralPath $n8nCliPath)) {
        throw "Pinned n8n CLI is missing at $n8nCliPath."
    }

    Write-Log "Starting pinned n8n using $nodePath $n8nCliPath start."
    New-Item -ItemType Directory -Path $AutomationDataDir -Force | Out-Null
    New-Item -ItemType Directory -Path $AutomationTempDir -Force | Out-Null
    Remove-Item -LiteralPath $RuntimeLogFile -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $RuntimeErrorLogFile -Force -ErrorAction SilentlyContinue

    $originalPath = $env:PATH
    $originalN8nUserFolder = $env:N8N_USER_FOLDER
    $originalTemp = $env:TEMP
    $originalTmp = $env:TMP
    $env:N8N_USER_FOLDER = $AutomationDataDir
    $env:TEMP = $AutomationTempDir
    $env:TMP = $AutomationTempDir

    $pathPrefix = @((Split-Path -Parent $nodePath))
    if ($gitPath) {
        $pathPrefix += (Split-Path -Parent $gitPath)
        $gitMingwBin = Join-Path (Split-Path -Parent (Split-Path -Parent $gitPath)) 'mingw64\bin'
        if (Test-Path -LiteralPath $gitMingwBin) {
            $pathPrefix += $gitMingwBin
        }
    }
    $env:PATH = ($pathPrefix -join ';') + ';' + $originalPath

    try {
        $process = Start-Process -FilePath $nodePath `
            -ArgumentList @($n8nCliPath, 'start') `
            -WorkingDirectory $AutomationHome `
            -WindowStyle Hidden `
            -RedirectStandardOutput $RuntimeLogFile `
            -RedirectStandardError $RuntimeErrorLogFile `
            -PassThru
        Write-Log "Started pinned n8n process $($process.Id)."
    } finally {
        $env:PATH = $originalPath
        $env:N8N_USER_FOLDER = $originalN8nUserFolder
        $env:TEMP = $originalTemp
        $env:TMP = $originalTmp
    }

    if (-not (Wait-ForN8n)) {
        Stop-ListeningAutomationProcess -Port $N8nPort
        if (Test-LocalPort -Port $N8nPort) {
            throw "n8n started but never became ready at $N8nReadyUrl. See $RuntimeLogFile and $RuntimeErrorLogFile for details."
        }
        throw "n8n did not start on port $N8nPort. See $RuntimeLogFile and $RuntimeErrorLogFile for details."
    }

    $startedAt = (Get-Date).ToString('o')
    Save-Status -Running $true -StartedAt $startedAt
    Write-Log "n8n is healthy at $N8nReadyUrl."
}

function Get-ErrorCategory {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Message
    )

    if ($Message -match 'Insufficient disk space') { return 'DiskSpace' }
    if ($Message -match 'Checksum') { return 'RuntimeChecksum' }
    if ($Message -match 'download') { return 'RuntimeDownload' }
    if ($Message -match 'runtime source|runtime is missing') { return 'RuntimeMissing' }
    if ($Message -match 'Robocopy failed|Runtime installation completed|Extract') { return 'RuntimeExtraction' }
    if ($Message -match 'Port 5678 is already in use') { return 'PortConflict' }
    if ($Message -match 'n8n did not start|never became ready') { return 'N8nStartup' }
    return 'BootstrapFailure'
}

try {
    Clear-LastError
    Write-Log 'Starting Drodo automation runtime bootstrap.'
    Write-Log "Resolved Drodo app version $AppVersion."
    Ensure-RuntimeInstalled
    Ensure-NodeAvailable
    Ensure-GitAvailable
    Ensure-N8nRunning
    Save-Status -Running $true -StartedAt (Get-Date).ToString('o')
    Write-Log 'Drodo automation runtime bootstrap completed successfully.'
} catch {
    $message = $_.Exception.Message
    $category = Get-ErrorCategory -Message $message
    Write-Log "Drodo automation runtime bootstrap failed [$category]: $message"
    Save-Status -Running $false -ErrorCategory $category -ErrorMessage $message
    Save-LastError -Category $category -Message $message
    exit 1
}
