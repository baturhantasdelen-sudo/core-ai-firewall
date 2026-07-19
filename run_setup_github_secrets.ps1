# run_setup_github_secrets.ps1
# GitHub Actions secret kurulum sihirbazı — değerler terminal geçmişine yazılmaz.

$ErrorActionPreference = "Stop"
$env:PYTHONIOENCODING = "utf-8"

function Read-SecurePlainText {
    param([string]$Prompt)
    $secure = Read-Host $Prompt -AsSecureString
    $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
        return [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
    }
    finally {
        [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
}

function Set-OneSecret {
    param(
        [string]$Name,
        [string]$Value
    )
    $env:SECRET_VALUE = $Value
    python setup_github_secrets.py --name $Name
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    Remove-Item Env:\SECRET_VALUE -ErrorAction SilentlyContinue
}

Write-Host "`n=== GitHub Actions Secret Kurulumu ===" -ForegroundColor Cyan
Write-Host "Repo: baturhantasdelen-sudo/core-ai-firewall`n"

$env:GITHUB_TOKEN = Read-SecurePlainText "GitHub PAT (repo + admin:repo_hook yetkili ghp_...)"
if (-not $env:REPO_OWNER) { $env:REPO_OWNER = "baturhantasdelen-sudo" }

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

Write-Host "`nMevcut secret durumu kontrol ediliyor..." -ForegroundColor DarkGray
python check_github_secrets.py
Write-Host ""

$secrets = @(
    @{
        Name = "DOCKER_USERNAME"
        Prompt = "Docker Hub kullanici adi"
        Secure = $false
    },
    @{
        Name = "DOCKER_PASSWORD"
        Prompt = "Docker Hub sifre veya access token"
        Secure = $true
    },
    @{
        Name = "PROD_SERVER_IP"
        Prompt = "Production sunucu IP (ornek: 203.0.113.10)"
        Secure = $false
    },
    @{
        Name = "PROD_SERVER_USER"
        Prompt = "SSH kullanici adi (ornek: root veya ubuntu)"
        Secure = $false
    },
    @{
        Name = "PROD_SSH_PRIVATE_KEY"
        Prompt = $null
        Secure = $true
    }
)

foreach ($item in $secrets) {
    $answer = Read-Host "$($item.Name) yuklensin mi? [E/h]"
    if ($answer -match "^[hH]") { continue }

    if ($item.Name -eq "PROD_SSH_PRIVATE_KEY") {
        $defaultKey = Join-Path $env:USERPROFILE ".ssh\nexus_deploy"
        if (Test-Path $defaultKey) {
            $useDefault = Read-Host "~/.ssh/nexus_deploy bulundu. Bu anahtar kullanilsin mi? [E/h]"
            if ($useDefault -notmatch "^[hH]") {
                $value = Get-Content $defaultKey -Raw
            }
            else {
                $value = Read-SecurePlainText "SSH private key icerigini yapistirin (tam PEM/OpenSSH)"
            }
        }
        else {
            Write-Host "nexus_deploy bulunamadi. Once: ssh-keygen -t ed25519 -f `$env:USERPROFILE\.ssh\nexus_deploy" -ForegroundColor Yellow
            $value = Read-SecurePlainText "SSH private key icerigini yapistirin"
        }
    }
    elseif ($item.Secure) {
        $value = Read-SecurePlainText $item.Prompt
    }
    else {
        $value = Read-Host $item.Prompt
    }

    Set-OneSecret -Name $item.Name -Value $value
    $value = $null
}

Write-Host "`nSon durum:" -ForegroundColor Cyan
python check_github_secrets.py

Remove-Item Env:\GITHUB_TOKEN -ErrorAction SilentlyContinue
Remove-Item Env:\REPO_OWNER -ErrorAction SilentlyContinue
Remove-Item Env:\SECRET_VALUE -ErrorAction SilentlyContinue
[System.GC]::Collect()

Write-Host "`nTamamlandi. Public key sunucuya ekleyin:" -ForegroundColor Green
$pubKeyPath = Join-Path $env:USERPROFILE ".ssh\nexus_deploy.pub"
if (Test-Path $pubKeyPath) {
    Write-Host (Get-Content $pubKeyPath -Raw)
    Write-Host "Sunucuda: echo '<yukaridaki satir>' >> ~/.ssh/authorized_keys" -ForegroundColor DarkGray
}
