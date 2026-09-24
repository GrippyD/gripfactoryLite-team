# THE ROAD LANE (canon 0.30.51). Owner, 2026-09-12: "I'm about to go on the road
# home for the weekend.  I'm going to be running this from my phone, but the
# terminal should stay up in the background.  Give me whatever permission
# requests you need to make commits and deployments".
#
# This watcher runs in the owner's own PowerShell window on the machine where
# wrangler is authorized. The Scribe cannot reach Cloudflare from its sandbox,
# so a deploy request is a FILE the Scribe commits into the repo:
#
#   DEPLOY\request.json   { "id": "<uuid>", "mode": "fast" | "migrate", "canon": "0.30.x", "note": "..." }
#
# Every 20 seconds the watcher writes DEPLOY\heartbeat.txt and looks for a
# request it has not handled. For one it has not: tsc, the tests, then (mode
# migrate only) the D1 probe and the migrations apply with the database name
# read from wrangler.toml (THE NAME LAW FOR DEPLOYS, canon 0.30.41), then
# npm run deploy:grip. A red step stops the chain; nothing deploys on red
# tests. The full output lands in DEPLOY\log\<id>.txt, the verdict in
# DEPLOY\result.json (also DEPLOY\results\<id>.json), and the request moves to
# DEPLOY\done\<id>.json so it never runs twice. The Scribe stages the result
# back and folds the version id into canon as always.
#
# Only env grip, only this repo, only what the standing block already does.
# Stop it with Ctrl+C, or by creating DEPLOY\stop.
#
# Start (from the app folder):
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-watch.ps1

$ErrorActionPreference = "Continue"
$ScriptDir = Split-Path -Parent $PSCommandPath
$AppDir = Split-Path -Parent $ScriptDir
$Root = Split-Path -Parent $AppDir
$DeployDir = Join-Path $Root "DEPLOY"
$DoneDir = Join-Path $DeployDir "done"
$LogDir = Join-Path $DeployDir "log"
$ResultsDir = Join-Path $DeployDir "results"
$RequestFile = Join-Path $DeployDir "request.json"
$ResultFile = Join-Path $DeployDir "result.json"
$HeartbeatFile = Join-Path $DeployDir "heartbeat.txt"
$StopFile = Join-Path $DeployDir "stop"
$PollSeconds = 20

foreach ($d in @($DeployDir, $DoneDir, $LogDir, $ResultsDir)) {
  if (-not (Test-Path $d)) { New-Item -ItemType Directory -Path $d | Out-Null }
}

function Now-Iso { (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ") }

function Write-Utf8([string]$Path, [string]$Text) {
  [System.IO.File]::WriteAllText($Path, $Text, (New-Object System.Text.UTF8Encoding($false)))
}

function Run-Step([string]$Label, [scriptblock]$Command, [System.Text.StringBuilder]$Log) {
  [void]$Log.AppendLine("")
  [void]$Log.AppendLine("==== $Label  (" + (Now-Iso) + ")")
  Write-Host ("[road] " + $Label) -ForegroundColor Cyan
  $global:LASTEXITCODE = 0
  $output = & $Command 2>&1 | ForEach-Object { $_.ToString() }
  $code = $LASTEXITCODE
  foreach ($line in $output) { [void]$Log.AppendLine($line) }
  [void]$Log.AppendLine("---- exit $code")
  Write-Host ("[road] " + $Label + " exit " + $code) -ForegroundColor $(if ($code -eq 0) { "Green" } else { "Red" })
  return @{ code = $code; output = ($output -join "`n") }
}

function Database-Name {
  $toml = Get-Content (Join-Path $AppDir "wrangler.toml") -Raw
  $m = [regex]::Match($toml, '(?s)\[\[env\.grip\.d1_databases\]\].*?database_name = "([^"]+)"')
  if (-not $m.Success) { return "" }
  return $m.Groups[1].Value
}

function Handle-Request($req) {
  $id = [string]$req.id
  $mode = [string]$req.mode
  if (-not $mode) { $mode = "fast" }
  $log = New-Object System.Text.StringBuilder
  [void]$log.AppendLine("THE ROAD LANE: request $id, mode $mode, canon $($req.canon), note: $($req.note)")
  [void]$log.AppendLine("started " + (Now-Iso) + " in " + $AppDir)
  $result = [ordered]@{
    id = $id; mode = $mode; canon = [string]$req.canon; ok = $false; step_failed = ""
    version_id = ""; tsc_exit = $null; test_exit = $null; probe_exit = $null; migrate_exit = $null; deploy_exit = $null
    started_at = (Now-Iso); finished_at = ""; log_file = "DEPLOY/log/$id.txt"; machine = $env:COMPUTERNAME
  }
  Set-Location $AppDir
  $step = Run-Step "npx tsc --noEmit" { npx tsc --noEmit } $log
  $result.tsc_exit = $step.code
  if ($step.code -ne 0) { $result.step_failed = "tsc" }
  if (-not $result.step_failed) {
    $step = Run-Step "npm test" { npm test } $log
    $result.test_exit = $step.code
    if ($step.code -ne 0) { $result.step_failed = "tests" }
  }
  if (-not $result.step_failed -and $mode -eq "migrate") {
    $D = Database-Name
    [void]$log.AppendLine("database_name from wrangler.toml: '$D'")
    if (-not $D) {
      $result.step_failed = "database name"
    } else {
      $step = Run-Step "d1 probe SELECT 1" { npx wrangler d1 execute $D --env grip --remote --command "SELECT 1" } $log
      $result.probe_exit = $step.code
      if ($step.code -ne 0) {
        $result.step_failed = "probe"
      } else {
        $step = Run-Step "d1 migrations apply" { "y" | npx wrangler d1 migrations apply $D --env grip --remote } $log
        $result.migrate_exit = $step.code
        if ($step.code -ne 0) { $result.step_failed = "migrate" }
      }
    }
  }
  if (-not $result.step_failed) {
    $step = Run-Step "npm run deploy:grip" { npm run deploy:grip } $log
    $result.deploy_exit = $step.code
    if ($step.code -ne 0) {
      $result.step_failed = "deploy"
    } else {
      # wrangler prints "Current Version ID: <uuid>" last; the bindings list
      # above it carries the database id, so the labeled match wins and the
      # last uuid in the output is the fallback.
      $labeled = [regex]::Match($step.output, 'Version ID:\s*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})')
      if ($labeled.Success) {
        $result.version_id = $labeled.Groups[1].Value
      } else {
        $ids = [regex]::Matches($step.output, '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}')
        if ($ids.Count -gt 0) { $result.version_id = $ids[$ids.Count - 1].Value }
      }
      $result.ok = $true
    }
  }
  $result.finished_at = (Now-Iso)
  [void]$log.AppendLine("")
  [void]$log.AppendLine("finished " + $result.finished_at + " ok=" + $result.ok + " failed=" + $result.step_failed + " version=" + $result.version_id)
  Write-Utf8 (Join-Path $LogDir "$id.txt") $log.ToString()
  $json = ($result | ConvertTo-Json -Depth 4)
  Write-Utf8 $ResultFile $json
  Write-Utf8 (Join-Path $ResultsDir "$id.json") $json
  Move-Item -Path $RequestFile -Destination (Join-Path $DoneDir "$id.json") -Force
  if ($result.ok) {
    Write-Host ("[road] DEPLOYED " + $result.version_id + " for request " + $id) -ForegroundColor Green
  } else {
    Write-Host ("[road] STOPPED at " + $result.step_failed + " for request " + $id) -ForegroundColor Red
  }
}

Write-Host "[road] THE ROAD LANE watching $RequestFile every $PollSeconds s. Ctrl+C or DEPLOY\stop ends it." -ForegroundColor Yellow
while ($true) {
  if (Test-Path $StopFile) {
    Write-Host "[road] stop file found; leaving." -ForegroundColor Yellow
    Remove-Item $StopFile -Force -ErrorAction SilentlyContinue
    break
  }
  Write-Utf8 $HeartbeatFile ((Now-Iso) + " alive on " + $env:COMPUTERNAME + "`n")
  if (Test-Path $RequestFile) {
    $req = $null
    try { $req = Get-Content $RequestFile -Raw | ConvertFrom-Json } catch { $req = $null }
    if ($req -and $req.id) {
      $donePath = Join-Path $DoneDir ("" + $req.id + ".json")
      if (Test-Path $donePath) {
        # already handled; the file is stale, retire it
        Move-Item -Path $RequestFile -Destination (Join-Path $DoneDir ("" + $req.id + ".stale.json")) -Force
      } else {
        try { Handle-Request $req } catch {
          Write-Host ("[road] request failed: " + $_.Exception.Message) -ForegroundColor Red
          Write-Utf8 $ResultFile (@{ id = $req.id; ok = $false; step_failed = "watcher"; error = $_.Exception.Message; finished_at = (Now-Iso) } | ConvertTo-Json)
          Move-Item -Path $RequestFile -Destination (Join-Path $DoneDir ("" + $req.id + ".failed.json")) -Force -ErrorAction SilentlyContinue
        }
      }
    } elseif ((Get-Item $RequestFile).LastWriteTime -lt (Get-Date).AddMinutes(-2)) {
      # unreadable for two minutes: set it aside so the lane is not stuck
      Move-Item -Path $RequestFile -Destination (Join-Path $DoneDir ("unreadable-" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".json")) -Force
    }
  }
  Start-Sleep -Seconds $PollSeconds
}
