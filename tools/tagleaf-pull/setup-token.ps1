# GripFactory Lite, TL2: store the tagleaf-pusher Access token for the pull.
# Run once, in your own PowerShell window. The two values are typed hidden and
# saved protected by Windows (DPAPI) for your user on this machine only.
# Nothing is printed back, and the file is useless to anyone else.

$dir = Join-Path $env:LOCALAPPDATA 'gf-tagleaf'
New-Item -ItemType Directory -Force -Path $dir | Out-Null
$file = Join-Path $dir 'access.json'

$id = Read-Host 'CF-Access-Client-Id (from the tagleaf-pusher service token)' -AsSecureString
$secret = Read-Host 'CF-Access-Client-Secret' -AsSecureString

if ($id.Length -eq 0 -or $secret.Length -eq 0) {
  Write-Host 'Both values are needed. Nothing was saved.'
  exit 1
}

@{
  id = ($id | ConvertFrom-SecureString)
  secret = ($secret | ConvertFrom-SecureString)
  saved_at = (Get-Date).ToString('o')
} | ConvertTo-Json | Set-Content -Path $file -Encoding UTF8

Write-Host "Saved to $file (protected for $env:USERNAME on this machine)."
