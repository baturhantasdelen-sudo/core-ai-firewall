# run_check_github_secrets.ps1
# GitHub Actions secret varlık kontrolü — PAT terminal geçmişine yazılmaz.

$ErrorActionPreference = "Stop"

# 1. Ortam kodlamasını Türkçe karakter uyumu için ayarla
$env:PYTHONIOENCODING = "utf-8"

# 2. Tokenı terminal geçmişine basmadan, maskeli olarak al
$secureToken = Read-Host "Lutfen GitHub PAT (ghp_...) girin" -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)
try {
    $env:GITHUB_TOKEN = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
}
finally {
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR)
}

# 3. Repo sahibi (ortam değişkeni yoksa varsayılan)
$DefaultRepoOwner = "baturhantasdelen-sudo"
if (-not $env:REPO_OWNER) {
    $env:REPO_OWNER = $DefaultRepoOwner
    Write-Host "REPO_OWNER = $DefaultRepoOwner" -ForegroundColor DarkGray
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

# 4. Doğrulama motorunu ateşle
python check_github_secrets.py
$exitCode = $LASTEXITCODE

# 5. GÜVENLİK TEMİZLİĞİ: İşlem biter bitmez hassas değişkenleri hafızadan uçur
Remove-Item Env:\GITHUB_TOKEN -ErrorAction SilentlyContinue
Remove-Item Env:\REPO_OWNER -ErrorAction SilentlyContinue
[System.GC]::Collect()

Write-Host "Bellek temizlendi, hassas veriler hafızadan silindi!" -ForegroundColor Yellow

exit $exitCode
