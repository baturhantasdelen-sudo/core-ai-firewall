# verify_production_server.ps1
# GCP production sunucusunun GitHub Actions deploy icin hazir olup olmadigini dogrular.
#
# Kullanim:
#   .\verify_production_server.ps1 -ServerIp "<GCE_STATIC_IP>" -SshUser "ubuntu"
#   $env:PROD_SERVER_IP = "<GCE_STATIC_IP>"; $env:PROD_SERVER_USER = "ubuntu"; .\verify_production_server.ps1

param(
    [string]$ServerIp = $env:PROD_SERVER_IP,
    [string]$SshUser = $env:PROD_SERVER_USER,
    [string]$PrivateKeyPath = (Join-Path $env:USERPROFILE ".ssh\nexus_deploy"),
    [string]$PublicKeyPath = (Join-Path $env:USERPROFILE ".ssh\nexus_deploy.pub"),
    [int]$SshPort = 22,
    [string]$DeployPath = "/opt/nexus-core-firewall"
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "verify_remote_scripts.ps1")

function Write-Step {
    param([string]$Message)
    Write-Host "`n=== $Message ===" -ForegroundColor Cyan
}

function Write-Pass {
    param([string]$Message)
    Write-Host "[OK]   $Message" -ForegroundColor Green
}

function Write-Fail {
    param([string]$Message)
    Write-Host "[FAIL] $Message" -ForegroundColor Red
}

function Write-Warn {
    param([string]$Message)
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Get-SshExe {
    $sshCmd = Get-Command ssh.exe -ErrorAction SilentlyContinue
    $candidates = @(
        $(if ($sshCmd) { $sshCmd.Source }),
        "C:\Windows\System32\OpenSSH\ssh.exe",
        "C:\Program Files\Git\usr\bin\ssh.exe"
    ) | Where-Object { $_ -and (Test-Path $_) }
    if (-not $candidates) {
        throw "ssh.exe bulunamadi. OpenSSH Client veya Git for Windows kurun."
    }
    return $candidates[0]
}

function Invoke-RemoteCheck {
    param(
        [string]$SshExe,
        [string]$RemoteScript
    )
    $args = @(
        "-i", $PrivateKeyPath,
        "-p", "$SshPort",
        "-o", "BatchMode=yes",
        "-o", "StrictHostKeyChecking=accept-new",
        "-o", "ConnectTimeout=15",
        "${SshUser}@${ServerIp}",
        "bash -s"
    )
    $RemoteScript = ($RemoteScript -replace "`r`n", "`n" -replace "`r", "`n").Trim()
    $RemoteScript | & $SshExe @args 2>&1
}

function Test-TcpPort {
    param(
        [string]$HostName,
        [int]$Port,
        [int]$TimeoutMs = 15000
    )
    try {
        $result = Test-NetConnection -ComputerName $HostName -Port $Port -WarningAction SilentlyContinue
        return [bool]$result.TcpTestSucceeded
    }
    catch {
        return $false
    }
}

if (-not $ServerIp) {
    if ($env:PROD_SERVER_IP) {
        $ServerIp = $env:PROD_SERVER_IP
    }
    else {
        $ServerIp = Read-Host "GCP dis IP (PROD_SERVER_IP / GCE_STATIC_IP)"
    }
}
if (-not $SshUser) {
    if ($env:PROD_SERVER_USER) {
        $SshUser = $env:PROD_SERVER_USER
    }
    else {
        $SshUser = Read-Host "SSH kullanici adi (PROD_SERVER_USER, ornek: ubuntu)"
    }
}

Write-Host "`nNexus Quantum Guard - Production Sunucu Dogrulama" -ForegroundColor White
Write-Host "Hedef: ${SshUser}@${ServerIp}:${SshPort}" -ForegroundColor DarkGray
Write-Host "Deploy path: $DeployPath" -ForegroundColor DarkGray

$allPassed = $true

# ---------------------------------------------------------------------------
# 1) Sunucu erisilebilirligi + SSH portu
# ---------------------------------------------------------------------------
Write-Step "1/4 Sunucu aktif mi ve SSH (Port $SshPort) acik mi?"

try {
    $tcp = Test-NetConnection -ComputerName $ServerIp -Port $SshPort -WarningAction SilentlyContinue
    if ($tcp.TcpTestSucceeded) {
        Write-Pass "TCP baglantisi basarili: ${ServerIp}:${SshPort}"
    }
    else {
        Write-Fail "TCP baglantisi basarisiz: ${ServerIp}:${SshPort}"
        Write-Warn "Firewall / Security Group icinde port $SshPort acik mi kontrol edin."
        $allPassed = $false
    }
}
catch {
    Write-Fail "Ag testi yapilamadi: $($_.Exception.Message)"
    $allPassed = $false
}

# ICMP ping bilgi amaclidir (cogu sunucuda kapali olabilir)
try {
    if (Test-Connection -ComputerName $ServerIp -Count 1 -Quiet -ErrorAction SilentlyContinue) {
        Write-Pass "ICMP ping yanit veriyor (opsiyonel)."
    }
    else {
        Write-Warn "ICMP ping yanit vermiyor - bu normal olabilir; SSH TCP testi esas kriterdir."
    }
}
catch {
    Write-Warn "ICMP ping test edilemedi."
}

# GCP VPC firewall + UFW - gateway portlari (80 zorunlu, 443 TLS icin)
Write-Step "1b/4 GCP VPC gateway portlari (80 HTTP, 443 HTTPS)"
$gatewayResults = @{}
foreach ($port in @(80, 443)) {
    $open = Test-TcpPort -HostName $ServerIp -Port $port
    $gatewayResults[$port] = $open
    if ($open) {
        Write-Pass "GCP/VPC erisimi OK - port $port acik ($ServerIp`:$port)"
    }
    elseif ($port -eq 80) {
        Write-Fail "Port 80 erisilemiyor (${ServerIp}:80) - GCP Firewall uzerinde tcp:80 inbound acin ve nginx-gateway servisini baslatin."
        # Deploy oncesi port 80 kapali olabilir; SSH/Docker kontrollerine devam et
    }
    else {
        Write-Warn "Port 443 erisilemiyor (${ServerIp}:443) - TLS henuz yoksa normal; GCP Firewall uzerinde tcp:443 acik olmali."
    }
}

# ---------------------------------------------------------------------------
# SSH key dosyasi
# ---------------------------------------------------------------------------
if (-not (Test-Path $PrivateKeyPath)) {
    Write-Fail "Private key bulunamadi: $PrivateKeyPath"
    Write-Warn "Olusturmak icin: ssh-keygen -t ed25519 -f `"$PrivateKeyPath`" -C `"nexus-github-actions-deploy`""
    $allPassed = $false
}
else {
    Write-Pass "Private key mevcut: $PrivateKeyPath"
}

if (-not (Test-Path $PublicKeyPath)) {
    Write-Warn "Public key bulunamadi: $PublicKeyPath"
}
else {
    Write-Pass "Public key mevcut: $PublicKeyPath"
    $localFp = & ssh-keygen -lf $PublicKeyPath 2>$null
    if ($localFp) {
        Write-Host "       Yerel fingerprint: $localFp" -ForegroundColor DarkGray
    }
}

if (-not $allPassed) {
    Write-Host "`nSSH key veya SSH portu erisilemeden devam edilemiyor." -ForegroundColor Red
    exit 1
}

$SshExe = Get-SshExe
Write-Host "ssh.exe: $SshExe" -ForegroundColor DarkGray

# ---------------------------------------------------------------------------
# 2) Docker + docker compose
# ---------------------------------------------------------------------------
Write-Step "2/4 Docker ve Docker Compose kurulu mu?"

$dockerScript = Get-DockerCheckScript -DeployDir $DeployPath

try {
    $dockerOut = Invoke-RemoteCheck -SshExe $SshExe -RemoteScript $dockerScript
    $dockerText = ($dockerOut | Out-String).Trim()
    Write-Host $dockerText

    if ($dockerText -match "COMPOSE_MISSING") {
        Write-Fail "docker compose bulunamadi."
        $allPassed = $false
    }
    else {
        Write-Pass "Docker Compose mevcut."
    }

    if ($dockerText -match "DOCKER_DAEMON_OK") {
        Write-Pass "Docker daemon calisiyor."
    }
    elseif ($dockerText -match "DOCKER_DAEMON_FAIL") {
        Write-Fail "Docker daemon erisilemiyor. Sunucuda: sudo systemctl start docker"
        $allPassed = $false
    }

    if ($dockerText -match "DEPLOY_DIR_OK") {
        Write-Pass "Deploy klasoru mevcut: $DeployPath"
    }
    elseif ($dockerText -match "DEPLOY_DIR_MISSING") {
        Write-Warn "Deploy klasoru henuz yok: $DeployPath"
        Write-Warn "Ilk deploy oncesi sunucuda proje dosyalarini bu dizine kopyalayin."
    }
}
catch {
    Write-Fail "SSH uzerinden Docker kontrolu basarisiz: $($_.Exception.Message)"
    Write-Warn "Anahtar authorized_keys icinde degilse veya kullanici yanlissa bu adim duser."
    $allPassed = $false
}

# ---------------------------------------------------------------------------
# 3) authorized_keys dogrulama
# ---------------------------------------------------------------------------
Write-Step "3/4 SSH public key authorized_keys icinde mi?"

if (-not (Test-Path $PublicKeyPath)) {
    Write-Fail "Public key olmadan authorized_keys karsilastirmasi yapilamaz."
    $allPassed = $false
}
else {
    $pubKeyLine = (Get-Content $PublicKeyPath -Raw).Trim()
    $pubKeyBody = ($pubKeyLine -split "\s+", 3)[1]

    $authScript = Get-AuthCheckScript -KeyComment "nexus-github-actions-deploy"

    try {
        $authOut = Invoke-RemoteCheck -SshExe $SshExe -RemoteScript $authScript
        $authText = ($authOut | Out-String).Trim()
        Write-Host $authText

        if ($authText -match "AUTH_FILE_MISSING") {
            Write-Fail "~/.ssh/authorized_keys dosyasi yok."
            Write-Warn "Sunucuda calistirin:"
            Write-Host "  mkdir -p ~/.ssh && chmod 700 ~/.ssh" -ForegroundColor DarkGray
            Write-Host ("  echo {0} >> ~/.ssh/authorized_keys" -f $pubKeyLine) -ForegroundColor DarkGray
            Write-Host "  chmod 600 ~/.ssh/authorized_keys" -ForegroundColor DarkGray
            $allPassed = $false
        }
        elseif ($authText -match "AUTH_KEY_FOUND") {
            Write-Pass "Deploy public key authorized_keys icinde bulundu."
            Write-Host "       GitHub Secret PROD_SSH_PRIVATE_KEY bu anahtarin PRIVATE kismi olmali." -ForegroundColor DarkGray
        }
        else {
            Write-Fail "Deploy public key authorized_keys icinde bulunamadi."
            Write-Warn "Sunucuya ekleyin (root icin /root/.ssh/authorized_keys):"
            Write-Host ("  echo {0} >> ~/.ssh/authorized_keys" -f $pubKeyLine) -ForegroundColor DarkGray
            $allPassed = $false
        }
    }
    catch {
        Write-Fail "authorized_keys kontrolu basarisiz: $($_.Exception.Message)"
        $allPassed = $false
    }
}

# ---------------------------------------------------------------------------
# Ozet
# ---------------------------------------------------------------------------
Write-Step "4/4 Ozet"
if ($allPassed) {
    Write-Pass "GCP sunucusu deploy icin hazir gorunuyor."
    if ($gatewayResults[443]) {
        Write-Pass "HTTPS (443) erisilebilir."
    }
    exit 0
}

Write-Fail "Bazi kontroller basarisiz. Yukaridaki [FAIL]/[WARN] maddelerini duzeltin."
exit 1
