# Quick DNS + HTTP probe for nexusshield.ai routing issues.
# Usage: pwsh ./scripts/check-dns.ps1

$hosts = @(
  @{ Name = 'nexusshield.ai'; Types = @('A', 'CNAME') },
  @{ Name = 'www.nexusshield.ai'; Types = @('A', 'CNAME') },
  @{ Name = 'api.nexusshield.ai'; Types = @('A') },
  @{ Name = 'nexus-shield-dashboard.vercel.app'; Types = @('CNAME', 'A') }
)

Write-Host "`n=== DNS Records ===" -ForegroundColor Cyan
foreach ($entry in $hosts) {
  Write-Host "`n$($entry.Name):" -ForegroundColor Yellow
  foreach ($type in $entry.Types) {
    try {
      $records = Resolve-DnsName -Name $entry.Name -Type $type -ErrorAction Stop
      $records | Where-Object { $_.Section -eq 'Answer' -or $_.Type -in @('A', 'CNAME', 'AAAA') } |
        Format-Table Name, Type, TTL, IPAddress, NameHost -AutoSize
    } catch {
      Write-Host "  (no $type record)" -ForegroundColor DarkGray
    }
  }
}

Write-Host "`n=== HTTP Probes ===" -ForegroundColor Cyan
$urls = @(
  'https://nexusshield.ai/docs/benchmark',
  'https://www.nexusshield.ai/docs/benchmark',
  'https://nexus-shield-dashboard.vercel.app/docs/benchmark'
)
foreach ($url in $urls) {
  Write-Host "`n$url" -ForegroundColor Yellow
  curl.exe -I -L --max-redirs 5 --connect-timeout 10 $url 2>&1 | Select-String -Pattern 'HTTP/|Could not resolve|curl:'
}

Write-Host "`nSee docs/dns-cloudflare-setup.md for Cloudflare record templates.`n"
