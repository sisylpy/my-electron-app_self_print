param(
  [Parameter(Mandatory = $true)]
  [ValidateLength(1, 255)]
  [string]$Title,
  [string]$CurrentConversationScript = ''
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$OutputEncoding = [Console]::OutputEncoding

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class GrainPrintFocusWeixinWin32 {
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc callback, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
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

$verificationScriptPath = if ($CurrentConversationScript) {
  $CurrentConversationScript
} else {
  Join-Path $PSScriptRoot 'current-conversation.ps1'
}
$inlineTitleVerificationAvailable = $false
if (Test-Path $verificationScriptPath) {
  try {
    . $verificationScriptPath -LibraryOnly
    $inlineTitleVerificationAvailable = (
      $null -ne (Get-Command Get-TitleFromWindowsOcr -ErrorAction SilentlyContinue)
    )
  } catch {
    # Keep the established child-process verifier as a compatibility fallback.
    $inlineTitleVerificationAvailable = $false
  }
}

function Normalize-ConversationTitle([string]$value) {
  $normalized = [string]$value
  $normalized = $normalized.Trim()
  $normalized = $normalized -replace '[\r\n\t]+', ' '
  $normalized = $normalized -replace '(?<=[\u3400-\u9fff])\s+(?=[\u3400-\u9fff])', ''
  $normalized = $normalized -replace '\s*[（(]\s*\d+\s*[）)]\s*$', ''
  return $normalized.Trim()
}

$targetTitle = Normalize-ConversationTitle $Title

function Write-Result(
  [string]$code,
  [string]$message,
  [string]$status,
  [string[]]$details,
  [long]$elapsedMilliseconds
) {
  $rows = @()
  if ($status) {
    $rows = @([pscustomobject]@{
      title = $targetTitle
      status = $status
    })
  }
  [pscustomobject]@{
    code = $code
    message = $message
    selectedTitle = if ($code -eq 'SUCCESS') { $targetTitle } else { '' }
    conversations = $rows
    details = @($details)
    metrics = [pscustomobject]@{
      platform = 'win32'
      method = 'search-exact-result'
      totalMs = $elapsedMilliseconds
    }
  } | ConvertTo-Json -Depth 5 -Compress
}

function Get-WeixinWindow {
  $processIds = @(
    Get-Process -Name Weixin, WeChatAppEx, WeChat -ErrorAction SilentlyContinue |
      Select-Object -ExpandProperty Id -Unique
  )
  if (-not $processIds.Count) { return $null }

  $windows = New-Object System.Collections.Generic.List[object]
  $callback = [GrainPrintFocusWeixinWin32+EnumWindowsProc]{
    param([IntPtr]$windowHandle, [IntPtr]$parameter)
    [uint32]$windowProcessId = 0
    [void][GrainPrintFocusWeixinWin32]::GetWindowThreadProcessId($windowHandle, [ref]$windowProcessId)
    if ($processIds -notcontains [int]$windowProcessId) { return $true }
    if (-not [GrainPrintFocusWeixinWin32]::IsWindowVisible($windowHandle)) { return $true }
    $rect = New-Object GrainPrintFocusWeixinWin32+RECT
    [void][GrainPrintFocusWeixinWin32]::GetWindowRect($windowHandle, [ref]$rect)
    $width = $rect.Right - $rect.Left
    $height = $rect.Bottom - $rect.Top
    if ($width -lt 480 -or $height -lt 360) { return $true }
    [void]$windows.Add([pscustomobject]@{
      Handle = $windowHandle
      Left = $rect.Left
      Top = $rect.Top
      Right = $rect.Right
      Bottom = $rect.Bottom
      Width = $width
      Height = $height
    })
    return $true
  }
  [void][GrainPrintFocusWeixinWin32]::EnumWindows($callback, [IntPtr]::Zero)
  return $windows |
    Sort-Object @{ Expression = { $_.Width * $_.Height }; Descending = $true } |
    Select-Object -First 1
}

function Invoke-LeftClick([int]$x, [int]$y) {
  [void][GrainPrintFocusWeixinWin32]::SetCursorPos($x, $y)
  Start-Sleep -Milliseconds 90
  [GrainPrintFocusWeixinWin32]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)
  [GrainPrintFocusWeixinWin32]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)
}

function Invoke-Key([byte]$virtualKey) {
  [GrainPrintFocusWeixinWin32]::keybd_event($virtualKey, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 40
  [GrainPrintFocusWeixinWin32]::keybd_event($virtualKey, 0, 0x0002, [UIntPtr]::Zero)
}

function Invoke-ControlKey([byte]$virtualKey) {
  [GrainPrintFocusWeixinWin32]::keybd_event(0x11, 0, 0, [UIntPtr]::Zero)
  [GrainPrintFocusWeixinWin32]::keybd_event($virtualKey, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 40
  [GrainPrintFocusWeixinWin32]::keybd_event($virtualKey, 0, 0x0002, [UIntPtr]::Zero)
  [GrainPrintFocusWeixinWin32]::keybd_event(0x11, 0, 0x0002, [UIntPtr]::Zero)
}

function Invoke-WeixinToggleShortcut {
  [GrainPrintFocusWeixinWin32]::keybd_event(0x11, 0, 0, [UIntPtr]::Zero)
  [GrainPrintFocusWeixinWin32]::keybd_event(0x12, 0, 0, [UIntPtr]::Zero)
  [GrainPrintFocusWeixinWin32]::keybd_event(0x57, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 60
  [GrainPrintFocusWeixinWin32]::keybd_event(0x57, 0, 0x0002, [UIntPtr]::Zero)
  [GrainPrintFocusWeixinWin32]::keybd_event(0x12, 0, 0x0002, [UIntPtr]::Zero)
  [GrainPrintFocusWeixinWin32]::keybd_event(0x11, 0, 0x0002, [UIntPtr]::Zero)
}

function Set-SearchQueryWithAutomation($window, [string]$target) {
  $root = [System.Windows.Automation.AutomationElement]::FromHandle($window.Handle)
  if ($null -eq $root) { return $false }
  $elements = $root.FindAll(
    [System.Windows.Automation.TreeScope]::Descendants,
    [System.Windows.Automation.Condition]::TrueCondition
  )
  for ($index = 0; $index -lt $elements.Count; $index += 1) {
    try {
      $element = $elements.Item($index)
      if ($element.Current.IsOffscreen) { continue }
      if ($element.Current.ControlType -ne [System.Windows.Automation.ControlType]::Edit) { continue }
      $bounds = $element.Current.BoundingRectangle
      if ($bounds.IsEmpty) { continue }
      $centerX = $bounds.Left + ($bounds.Width / 2)
      $centerY = $bounds.Top + ($bounds.Height / 2)
      if ($centerX -lt ($window.Left + 60) -or $centerX -gt ($window.Left + 245)) { continue }
      if ($centerY -lt ($window.Top + 20) -or $centerY -gt ($window.Top + 86)) { continue }
      $pattern = $null
      if (-not $element.TryGetCurrentPattern(
        [System.Windows.Automation.ValuePattern]::Pattern,
        [ref]$pattern
      )) { continue }
      $pattern.SetValue($target)
      return $true
    } catch {
      # Fall back to the bounded physical search box below.
    }
  }
  return $false
}

function Find-ExactSearchResult($window, [string]$target) {
  $root = [System.Windows.Automation.AutomationElement]::FromHandle($window.Handle)
  if ($null -eq $root) { return $null }
  $elements = $root.FindAll(
    [System.Windows.Automation.TreeScope]::Descendants,
    [System.Windows.Automation.Condition]::TrueCondition
  )
  $minimumX = $window.Left + 56
  $maximumX = $window.Left + [math]::Min(390, [math]::Round($window.Width * 0.64))
  $minimumY = $window.Top + 78
  $maximumY = $window.Bottom - 70
  $candidates = New-Object System.Collections.Generic.List[object]

  for ($index = 0; $index -lt $elements.Count; $index += 1) {
    try {
      $element = $elements.Item($index)
      if ($element.Current.IsOffscreen) { continue }
      $name = Normalize-ConversationTitle $element.Current.Name
      if ($name -cne $target) { continue }
      $bounds = $element.Current.BoundingRectangle
      if ($bounds.IsEmpty) { continue }
      $centerX = [math]::Round($bounds.Left + ($bounds.Width / 2))
      $centerY = [math]::Round($bounds.Top + ($bounds.Height / 2))
      if ($centerX -lt $minimumX -or $centerX -gt $maximumX) { continue }
      if ($centerY -lt $minimumY -or $centerY -gt $maximumY) { continue }
      if ($bounds.Height -lt 8 -or $bounds.Height -gt 100) { continue }
      [void]$candidates.Add([pscustomobject]@{
        X = $centerX
        Y = $centerY
        Top = $bounds.Top
        Left = $bounds.Left
      })
    } catch {
      # Weixin can invalidate individual UIA nodes while search results redraw.
    }
  }
  return $candidates |
    Sort-Object @{ Expression = 'Top'; Descending = $false }, @{ Expression = 'Left'; Descending = $false } |
    Select-Object -First 1
}

function Get-VisibleConversationTitle($window, [string]$scriptPath) {
  if (-not $scriptPath -or -not (Test-Path $scriptPath)) { return '' }
  if ($inlineTitleVerificationAvailable) {
    $artifactDirectory = Join-Path (
      [System.IO.Path]::GetTempPath()
    ) ('grainprint-wechat-focus-' + [guid]::NewGuid().ToString('N'))
    $screenshotPath = Join-Path $artifactDirectory 'conversation-header.png'
    try {
      [void](New-Item -ItemType Directory -Force -Path $artifactDirectory)
      $ocr = Get-TitleFromWindowsOcr $window $screenshotPath
      if ($ocr.Title) { return Normalize-ConversationTitle $ocr.Title }
      $automation = Get-TitleFromAutomation $window
      if ($automation.Title) { return Normalize-ConversationTitle $automation.Title }
      return ''
    } finally {
      Remove-Item -Force -ErrorAction SilentlyContinue $screenshotPath
      Remove-Item -Force -ErrorAction SilentlyContinue $artifactDirectory
    }
  }
  $rows = @(& powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $scriptPath)
  $json = $rows |
    Where-Object { ([string]$_).Trim().StartsWith('{') } |
    Select-Object -Last 1
  if (-not $json) { return '' }
  try {
    $payload = ([string]$json) | ConvertFrom-Json
    if ($payload.code -ne 'SUCCESS') { return '' }
    return Normalize-ConversationTitle $payload.conversationTitle
  } catch {
    return ''
  }
}

$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
$details = New-Object System.Collections.Generic.List[string]
function Add-ElapsedDetail([string]$stage) {
  [void]$details.Add("TIMING_$($stage)_MS=$([long]$stopwatch.ElapsedMilliseconds)")
}
try {
  if (-not $targetTitle) { throw 'EMPTY_TARGET_TITLE' }
  $window = Get-WeixinWindow
  if ($null -eq $window) {
    $running = @(Get-Process -Name Weixin, WeChatAppEx, WeChat -ErrorAction SilentlyContinue)
    if ($running.Count) {
      Invoke-WeixinToggleShortcut
      for ($attempt = 0; $attempt -lt 10 -and $null -eq $window; $attempt += 1) {
        Start-Sleep -Milliseconds 250
        $window = Get-WeixinWindow
      }
    }
  }
  Add-ElapsedDetail 'WINDOW_READY'
  if ($null -eq $window) {
    Write-Result -code 'WEIXIN_MAIN_WINDOW_NOT_READY' -message '没有找到已登录的微信窗口，请先打开微信聊天窗口' -status '' -details @('WINDOW_NOT_FOUND') -elapsedMilliseconds ([long]$stopwatch.ElapsedMilliseconds)
    exit 3
  }

  [void][GrainPrintFocusWeixinWin32]::ShowWindow($window.Handle, 9)
  [void][GrainPrintFocusWeixinWin32]::SetForegroundWindow($window.Handle)
  [void]$details.Add("WINDOW_BOUNDS=$($window.Left),$($window.Top),$($window.Width),$($window.Height)")
  Start-Sleep -Milliseconds 220

  # Weixin 4.x keeps the search box in a fixed column: the navigation rail is
  # about 60px wide and the conversation list ends near x=240, even when the
  # chat pane grows. Clicking this bounded center can never hit the composer.
  if (Set-SearchQueryWithAutomation $window $targetTitle) {
    [void]$details.Add('SEARCH_QUERY_UIA_SET')
  } else {
    # Compact Weixin shows only the magnifier glyph; clicking the empty center
    # of the former edit field does nothing. Target the glyph itself.
    $searchX = $window.Left + [math]::Min(166, [math]::Round($window.Width * 0.253))
    $searchY = $window.Top + 57
    [void]$details.Add("SEARCH_POINT=$searchX,$searchY")
    Invoke-LeftClick $searchX $searchY
    Start-Sleep -Milliseconds 120
    Invoke-ControlKey 0x41
    [System.Windows.Forms.Clipboard]::SetText($targetTitle)
    Invoke-ControlKey 0x56
    [void]$details.Add('SEARCH_QUERY_KEYBOARD_ENTERED')
  }
  Add-ElapsedDetail 'QUERY_READY'

  $result = $null
  for ($attempt = 0; $attempt -lt 3 -and $null -eq $result; $attempt += 1) {
    Start-Sleep -Milliseconds 180
    $result = Find-ExactSearchResult $window $targetTitle
  }
  if ($null -eq $result) {
    # Weixin 4.x renders search rows in a custom surface that is not exposed
    # through UI Automation. The first direct result has a stable row, while
    # the visible-header verification below prevents a wrong row from ever
    # being reported as success.
    Invoke-LeftClick ($window.Left + 220) ($window.Top + 153)
    [void]$details.Add('FIRST_RESULT_POSITION_FALLBACK_CLICKED')
  } else {
    Invoke-LeftClick $result.X $result.Y
    [void]$details.Add('EXACT_SEARCH_RESULT_CLICKED')
  }
  Add-ElapsedDetail 'RESULT_CLICKED'
  Start-Sleep -Milliseconds 650
  Add-ElapsedDetail 'RESULT_SETTLED'

  $openedTitle = Get-VisibleConversationTitle $window $verificationScriptPath
  Add-ElapsedDetail 'TITLE_READ'
  if ($openedTitle -cne $targetTitle) {
    [void]$details.Add("VERIFIED_TITLE=$openedTitle")
    Write-Result -code 'VERIFY_FAILED' -message "微信切换后未能核验会话“$targetTitle”" -status '' -details ([string[]]@($details)) -elapsedMilliseconds ([long]$stopwatch.ElapsedMilliseconds)
    exit 2
  }

  [void]$details.Add('VISIBLE_HEADER_VERIFIED')
  # Return to the normal conversation list without using Escape, which hides
  # the whole Weixin window when the search overlay has already closed.
  Invoke-LeftClick ($window.Left + 37) ($window.Top + 112)
  Start-Sleep -Milliseconds 180
  Add-ElapsedDetail 'DONE'
  Write-Result -code 'SUCCESS' -message "已搜索并打开微信会话“$targetTitle”" -status 'OPENED' -details ([string[]]@($details)) -elapsedMilliseconds ([long]$stopwatch.ElapsedMilliseconds)
  exit 0
} catch {
  $diagnostic = "$($_.Exception.GetType().FullName):$($_.Exception.Message)"
  [void]$details.Add("ERROR=$diagnostic")
  Write-Result -code 'AUTOMATION_FAILED' -message 'Windows 微信会话切换失败，请保持微信聊天窗口打开后重试' -status '' -details ([string[]]@($details)) -elapsedMilliseconds ([long]$stopwatch.ElapsedMilliseconds)
  exit 1
}
