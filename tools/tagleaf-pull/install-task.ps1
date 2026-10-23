# GripFactory Lite, TL2: register the daily pull with Windows Task Scheduler.
# Run from this folder in your own PowerShell window, after --login and
# setup-token.ps1 have been done. The task runs as you, only while you are
# logged on, every day at 6:05 PM, and again at 7:35 AM for the COAs the lab
# posts overnight. Re-run this file to change the times; -Force replaces it.

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$node = (Get-Command node -ErrorAction Stop).Source
$script = Join-Path $here 'pull.mjs'
if (-not (Test-Path $script)) { throw "pull.mjs is not beside this file." }

$action = New-ScheduledTaskAction -Execute $node -Argument ('"' + $script + '"') -WorkingDirectory $here
$triggers = @(
  (New-ScheduledTaskTrigger -Daily -At '6:05PM'),
  (New-ScheduledTaskTrigger -Daily -At '7:35AM')
)
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 40) -MultipleInstances IgnoreNew
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName 'GripFactory TagLeaf pull' -Action $action -Trigger $triggers -Settings $settings -Principal $principal -Force | Out-Null
Write-Host "Registered 'GripFactory TagLeaf pull': $node $script at 6:05 PM and 7:35 AM daily, as $env:USERNAME while logged on."
Write-Host "Log: $env:LOCALAPPDATA\gf-tagleaf\pull.log. Run it now with: Start-ScheduledTask -TaskName 'GripFactory TagLeaf pull'"
