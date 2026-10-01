param(
  [int]$MaxIterations = 50,
  [int]$DwellMilliseconds = 1000,
  [string]$ResultPath = ''
)

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing
Add-Type @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class GrainPrintWeixinWin32 {
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc callback, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern int GetWindowTextLength(IntPtr hWnd);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassName(IntPtr hWnd, StringBuilder className, int count);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int command);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint flags, uint dx, uint dy, uint data, UIntPtr extraInfo);
  [DllImport("user32.dll")] public static extern void keybd_event(byte virtualKey, byte scanCode, uint flags, UIntPtr extraInfo);
  public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
}
'@

function Write-Result([string]$code, [string]$message, [int]$openedCount, [int]$iterations) {
  $json = [pscustomobject]@{
    code = $code
    message = $message
    conversations = @()
    metrics = [pscustomobject]@{
      openedCount = $openedCount
      iterations = $iterations
      platform = 'win32'
    }
  } | ConvertTo-Json -Depth 4 -Compress
  if ($ResultPath) { $json | Set-Content -Encoding UTF8 -Path $ResultPath }
  $json
}

function Invoke-LeftClick([int]$x, [int]$y, [bool]$doubleClick = $false) {
  [void][GrainPrintWeixinWin32]::SetCursorPos($x, $y)
  Start-Sleep -Milliseconds 80
  $count = if ($doubleClick) { 2 } else { 1 }
  for ($index = 0; $index -lt $count; $index += 1) {
    [GrainPrintWeixinWin32]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)
    [GrainPrintWeixinWin32]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)
    if ($doubleClick -and $index -eq 0) { Start-Sleep -Milliseconds 120 }
  }
}

function Get-WeixinWindow {
  # Weixin 4.x keeps the visible desktop window in a WeChatAppEx child
  # process, while older releases used Weixin/WeChat directly. Include all
  # supported process families and let the visibility/size checks below pick
  # the actual main window.
  $processNames = @('Weixin', 'WeChatAppEx', 'WeChat')
  $processIds = @(
    Get-Process -Name $processNames -ErrorAction SilentlyContinue |
      Select-Object -ExpandProperty Id -Unique
  )
  if (-not $processIds.Count) { return $null }

  $windows = New-Object System.Collections.Generic.List[object]
  $callback = [GrainPrintWeixinWin32+EnumWindowsProc]{
    param([IntPtr]$windowHandle, [IntPtr]$parameter)
    [uint32]$windowProcessId = 0
    [void][GrainPrintWeixinWin32]::GetWindowThreadProcessId($windowHandle, [ref]$windowProcessId)
    if ($processIds -notcontains [int]$windowProcessId) { return $true }
    $rect = New-Object GrainPrintWeixinWin32+RECT
    [void][GrainPrintWeixinWin32]::GetWindowRect($windowHandle, [ref]$rect)
    $width = $rect.Right - $rect.Left
    $height = $rect.Bottom - $rect.Top
    if ($width -lt 600 -or $height -lt 400) { return $true }
    $isVisible = [GrainPrintWeixinWin32]::IsWindowVisible($windowHandle)
    if (-not $isVisible) { return $true }
    $className = New-Object System.Text.StringBuilder 256
    [void][GrainPrintWeixinWin32]::GetClassName($windowHandle, $className, $className.Capacity)
    $windows.Add([pscustomobject]@{
      Handle = $windowHandle
      Visible = $isVisible
      ClassName = $className.ToString()
      Left = $rect.Left
      Top = $rect.Top
      Right = $rect.Right
      Bottom = $rect.Bottom
      Width = $width
      Height = $height
    })
    return $true
  }
  [void][GrainPrintWeixinWin32]::EnumWindows($callback, [IntPtr]::Zero)
  return $windows |
    Sort-Object @{ Expression = 'Visible'; Descending = $true }, @{ Expression = { $_.Width * $_.Height }; Descending = $true } |
    Select-Object -First 1
}

function Get-WeixinExecutable {
  $runningExecutable = Get-Process -Name Weixin -ErrorAction SilentlyContinue |
    ForEach-Object {
      try { $_.Path } catch { $null }
    } |
    Where-Object { $_ -and (Test-Path $_) } |
    Select-Object -First 1
  if ($runningExecutable) { return $runningExecutable }

  $candidates = @(
    (Join-Path $env:ProgramFiles 'Tencent\Weixin\Weixin.exe'),
    (Join-Path ${env:ProgramFiles(x86)} 'Tencent\Weixin\Weixin.exe'),
    (Join-Path $env:LOCALAPPDATA 'Tencent\Weixin\Weixin.exe')
  )
  return $candidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
}

function Wait-WeixinMainWindow {
  for ($attempt = 0; $attempt -lt 12; $attempt += 1) {
    Start-Sleep -Milliseconds 500
    $window = Get-WeixinWindow
    if ($null -ne $window) { return $window }
  }
  return $null
}

function Invoke-WeixinToggleShortcut {
  # Windows Weixin registers Ctrl+Alt+W as its global show/hide shortcut.
  # Only send it after confirming that no visible main window exists, so an
  # already-visible chat window is never hidden by this automation.
  [GrainPrintWeixinWin32]::keybd_event(0x11, 0, 0, [UIntPtr]::Zero)
  [GrainPrintWeixinWin32]::keybd_event(0x12, 0, 0, [UIntPtr]::Zero)
  [GrainPrintWeixinWin32]::keybd_event(0x57, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 80
  [GrainPrintWeixinWin32]::keybd_event(0x57, 0, 0x0002, [UIntPtr]::Zero)
  [GrainPrintWeixinWin32]::keybd_event(0x12, 0, 0x0002, [UIntPtr]::Zero)
  [GrainPrintWeixinWin32]::keybd_event(0x11, 0, 0x0002, [UIntPtr]::Zero)
}

function Hide-WeixinMainWindow($window) {
  if ($null -eq $window) { return }
  try {
    # Keep Weixin logged in and running. The global shortcut hides the chat
    # window back to the notification area and returns the user to GrainPrint.
    Invoke-WeixinToggleShortcut
    Start-Sleep -Milliseconds 400
    $remainingWindow = Get-WeixinWindow
    if ($null -ne $remainingWindow) {
      # Fallback for customized/disabled Weixin shortcuts: minimize the
      # verified main window instead of terminating the client process.
      [void][GrainPrintWeixinWin32]::ShowWindow($remainingWindow.Handle, 6)
    }
  } catch {
    [void][GrainPrintWeixinWin32]::ShowWindow($window.Handle, 6)
  }
}

function Get-WindowBitmap($window) {
  $bitmap = New-Object System.Drawing.Bitmap $window.Width, $window.Height
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.CopyFromScreen(
      (New-Object System.Drawing.Point $window.Left, $window.Top),
      [System.Drawing.Point]::Empty,
      (New-Object System.Drawing.Size $window.Width, $window.Height)
    )
    return $bitmap
  } finally {
    $graphics.Dispose()
  }
}

function Find-UnreadBadgeRows($bitmap) {
  # Weixin 4.x: conversation avatars occupy x=72..120 relative to the window.
  # Unread badges sit immediately above/right of the avatar. Restricting this
  # narrow band avoids red pixels in message previews and the navigation rail.
  $xStart = [math]::Max(0, [math]::Round($bitmap.Width * 0.105))
  $xEnd = [math]::Min($bitmap.Width - 1, [math]::Round($bitmap.Width * 0.145))
  $yStart = [math]::Max(72, [math]::Round($bitmap.Height * 0.12))
  $yEnd = [math]::Min($bitmap.Height - 24, [math]::Round($bitmap.Height * 0.95))

  $activeRows = New-Object System.Collections.Generic.List[int]
  for ($y = $yStart; $y -le $yEnd; $y += 1) {
    $redPixels = 0
    for ($x = $xStart; $x -le $xEnd; $x += 1) {
      $pixel = $bitmap.GetPixel($x, $y)
      if ($pixel.R -ge 238 -and $pixel.G -ge 45 -and $pixel.G -le 105 -and $pixel.B -ge 45 -and $pixel.B -le 105) {
        $redPixels += 1
      }
    }
    if ($redPixels -ge 3) { $activeRows.Add($y) }
  }

  if (-not $activeRows.Count) { return @() }
  $groups = New-Object System.Collections.Generic.List[object]
  $start = $activeRows[0]
  $last = $activeRows[0]
  for ($index = 1; $index -lt $activeRows.Count; $index += 1) {
    $value = $activeRows[$index]
    if ($value -le $last + 2) {
      $last = $value
      continue
    }
    $groups.Add([pscustomobject]@{ Start = $start; End = $last })
    $start = $value
    $last = $value
  }
  $groups.Add([pscustomobject]@{ Start = $start; End = $last })

  return @($groups |
    Where-Object { ($_.End - $_.Start + 1) -ge 5 -and ($_.End - $_.Start + 1) -le 28 } |
    ForEach-Object { [math]::Round(($_.Start + $_.End) / 2) } |
    Sort-Object)
}

$window = $null
try {
  $window = Get-WeixinWindow
  if ($null -eq $window) {
    $runningProcesses = @(
      Get-Process -Name Weixin, WeChatAppEx, WeChat -ErrorAction SilentlyContinue
    )
    if ($runningProcesses.Count -gt 0) {
      # An existing Weixin session may be minimized to the notification area.
      # Activate that session; never start a second login instance.
      Invoke-WeixinToggleShortcut
      $window = Wait-WeixinMainWindow
    } else {
      # Only a completely stopped client is allowed to enter the login flow.
      $executable = Get-WeixinExecutable
      if ($executable) { Start-Process -FilePath $executable }
      Write-Result 'WEIXIN_LOGIN_REQUIRED' 'Windows Weixin is not logged in. Complete the Weixin login window and try again.' 0 0
      exit 4
    }
  }
  if ($null -eq $window) {
    Write-Result 'WEIXIN_MAIN_WINDOW_NOT_READY' 'Windows Weixin is already running, but its chat window could not be activated. Open the existing Weixin window once and try again.' 0 0
    exit 3
  }

  [void][GrainPrintWeixinWin32]::ShowWindow($window.Handle, 9)
  [void][GrainPrintWeixinWin32]::SetForegroundWindow($window.Handle)
  Start-Sleep -Milliseconds 500

  # User-facing requirement: double-click the green chat logo so unread
  # conversations move to the top before scanning.
  $chatLogoX = $window.Left + [math]::Round($window.Width * 0.034)
  $chatLogoY = $window.Top + [math]::Round($window.Height * 0.173)
  Invoke-LeftClick $chatLogoX $chatLogoY $true
  Start-Sleep -Milliseconds 800

  $bitmap = Get-WindowBitmap $window
  try {
    $badgeRows = @(Find-UnreadBadgeRows $bitmap | Select-Object -First $MaxIterations)
  } finally {
    $bitmap.Dispose()
  }

  $openedCount = 0
  if (-not $badgeRows.Count) {
    Hide-WeixinMainWindow $window
    Write-Result 'NO_UNREAD' 'No unread Weixin conversations were found.' 0 0
    exit 0
  }

  foreach ($badgeYValue in $badgeRows) {
    $badgeY = [int]$badgeYValue
    $conversationX = $window.Left + [math]::Round($window.Width * 0.205)
    $conversationY = $window.Top + $badgeY + [math]::Round($window.Height * 0.026)
    Invoke-LeftClick $conversationX $conversationY $false
    $openedCount += 1
    Start-Sleep -Milliseconds $DwellMilliseconds
  }

  $iterations = $badgeRows.Count
  $code = if ($badgeRows.Count -ge $MaxIterations) { 'SCAN_LIMIT_REACHED' } else { 'SUCCESS' }
  Hide-WeixinMainWindow $window
  Write-Result $code '' $openedCount $iterations
  exit 0
} catch {
  Hide-WeixinMainWindow $window
  Write-Result 'AUTOMATION_FAILED' 'Windows Weixin visible scan failed.' 0 0
  exit 1
}
