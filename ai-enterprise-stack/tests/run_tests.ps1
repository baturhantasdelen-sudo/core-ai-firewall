$base = "http://localhost:8080"
$payloadDir = Join-Path $PSScriptRoot "payloads"

function Show-Test($title) {
    Write-Host ""
    Write-Host "=== $title ===" -ForegroundColor Cyan
}

Show-Test "A. Health Check"
curl.exe -s -X GET "$base/healthz"
Write-Host ""

Show-Test "B. NexusShield PII Masking"
curl.exe -i -X POST "$base/nexus/v1/chat/completions" `
    -H "Content-Type: application/json" `
    -H "Authorization: Bearer sk-your-key" `
    --data-binary "@$payloadDir/nexus_pii.json"

Show-Test "C. NexusShield Injection Block"
curl.exe -i -X POST "$base/nexus/v1/chat/completions" `
    -H "Content-Type: application/json" `
    --data-binary "@$payloadDir/nexus_injection.json"

Show-Test "D. ResoNet Local Ollama Route"
curl.exe -i -X POST "$base/resonet/v1/chat/completions" `
    -H "Content-Type: application/json" `
    --data-binary "@$payloadDir/resonet_local.json"

Show-Test "E. ResoNet Cloud Route & Compression"
curl.exe -i -X POST "$base/resonet/v1/chat/completions" `
    -H "Content-Type: application/json" `
    -H "Authorization: Bearer sk-your-key" `
    --data-binary "@$payloadDir/resonet_cloud.json"
