param(
  [string]$ArtifactRoot = ''
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)

Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class GrainPrintCurrentWeixinWin32 {
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc callback, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int command);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern void keybd_event(byte virtualKey, byte scanCode, uint flags, UIntPtr extraInfo);
  public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
}
'@

function Write-Result(
  [string]$code,
  [string]$message,
  [string]$conversationTitle,
  [string]$method,
  [int]$candidateCount,
  [long]$elapsedMilliseconds
) {
  [pscustomobject]@{
    code = $code
    message = $message
    conversationTitle = $conversationTitle
    details = @(
      "METHOD=$method"
      "CANDIDATE_COUNT=$candidateCount"
    )
    metrics = [pscustomobject]@{
      platform = 'win32'
      method = $method
      candidateCount = $candidateCount
      totalMs = $elapsedMilliseconds
    }
  } | ConvertTo-Json -Depth 4 -Compress
}

function Get-WeixinWindow {
  $processIds = @(
    Get-Process -Name Weixin, WeChatAppEx, WeChat -ErrorAction SilentlyContinue |
      Select-Object -ExpandProperty Id -Unique
  )
  if (-not $processIds.Count) { return $null }

  $windows = New-Object System.Collections.Generic.List[object]
  $callback = [GrainPrintCurrentWeixinWin32+EnumWindowsProc]{
    param([IntPtr]$windowHandle, [IntPtr]$parameter)
    [uint32]$windowProcessId = 0
    [void][GrainPrintCurrentWeixinWin32]::GetWindowThreadProcessId(
      $windowHandle,
      [ref]$windowProcessId
    )
    if ($processIds -notcontains [int]$windowProcessId) { return $true }
    if (-not [GrainPrintCurrentWeixinWin32]::IsWindowVisible($windowHandle)) { return $true }
    $rect = New-Object GrainPrintCurrentWeixinWin32+RECT
    [void][GrainPrintCurrentWeixinWin32]::GetWindowRect($windowHandle, [ref]$rect)
    $width = $rect.Right - $rect.Left
    $height = $rect.Bottom - $rect.Top
    if ($width -lt 480 -or $height -lt 360) { return $true }
    $windows.Add([pscustomobject]@{
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
  [void][GrainPrintCurrentWeixinWin32]::EnumWindows($callback, [IntPtr]::Zero)
  return $windows |
    Sort-Object @{ Expression = { $_.Width * $_.Height }; Descending = $true } |
    Select-Object -First 1
}

function Invoke-WeixinToggleShortcut {
  [GrainPrintCurrentWeixinWin32]::keybd_event(0x11, 0, 0, [UIntPtr]::Zero)
  [GrainPrintCurrentWeixinWin32]::keybd_event(0x12, 0, 0, [UIntPtr]::Zero)
  [GrainPrintCurrentWeixinWin32]::keybd_event(0x57, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 80
  [GrainPrintCurrentWeixinWin32]::keybd_event(0x57, 0, 0x0002, [UIntPtr]::Zero)
  [GrainPrintCurrentWeixinWin32]::keybd_event(0x12, 0, 0x0002, [UIntPtr]::Zero)
  [GrainPrintCurrentWeixinWin32]::keybd_event(0x11, 0, 0x0002, [UIntPtr]::Zero)
}

function Wait-WeixinMainWindow {
  for ($attempt = 0; $attempt -lt 12; $attempt += 1) {
    Start-Sleep -Milliseconds 250
    $window = Get-WeixinWindow
    if ($null -ne $window) { return $window }
  }
  return $null
}

function Show-WeixinWindow {
  $window = Get-WeixinWindow
  if ($null -eq $window) {
    $running = @(Get-Process -Name Weixin, WeChatAppEx, WeChat -ErrorAction SilentlyContinue)
    if (-not $running.Count) { return $null }
    Invoke-WeixinToggleShortcut
    $window = Wait-WeixinMainWindow
  }
  if ($null -ne $window) {
    [void][GrainPrintCurrentWeixinWin32]::ShowWindow($window.Handle, 9)
    [void][GrainPrintCurrentWeixinWin32]::SetForegroundWindow($window.Handle)
    Start-Sleep -Milliseconds 180
  }
  return $window
}

function Normalize-ConversationTitle([string]$value) {
  $title = [string]$value
  $title = $title.Trim()
  $title = $title -replace '[\r\n\t]+', ' '
  $title = $title -replace '\s*[（(]\d+[）)]\s*$', ''
  return $title.Trim()
}

function Test-ConversationTitle([string]$value) {
  $title = Normalize-ConversationTitle $value
  if (-not $title -or $title.Length -gt 255) { return $false }
  $ignored = @(
    '微信', 'WeChat', 'Weixin', '搜索', '聊天', '通讯录', '收藏', '朋友圈',
    '小程序', '手机', '更多', '聊天信息', '语音聊天', '视频聊天', '发送',
    '表情', '文件', '截图', '关闭', '最小化', '最大化', '还原'
  )
  if ($ignored -contains $title) { return $false }
  if ($title -match '^\d{1,2}:\d{2}$') { return $false }
  if ($title -match '^(昨天|星期[一二三四五六日天]|周[一二三四五六日天])$') { return $false }
  return $true
}

function Get-TitleFromAutomation($window) {
  $root = [System.Windows.Automation.AutomationElement]::FromHandle($window.Handle)
  if ($null -eq $root) { return [pscustomobject]@{ Title = ''; Count = 0 } }
  $elements = $root.FindAll(
    [System.Windows.Automation.TreeScope]::Descendants,
    [System.Windows.Automation.Condition]::TrueCondition
  )
  $candidates = New-Object System.Collections.Generic.List[object]
  $minimumX = $window.Left + [math]::Max(120, [math]::Round($window.Width * 0.16))
  $maximumX = $window.Right - 70
  $minimumY = $window.Top + 24
  $maximumY = $window.Top + [math]::Min(132, [math]::Round($window.Height * 0.17))

  for ($index = 0; $index -lt $elements.Count; $index += 1) {
    try {
      $element = $elements.Item($index)
      if ($element.Current.IsOffscreen) { continue }
      $name = Normalize-ConversationTitle $element.Current.Name
      if (-not (Test-ConversationTitle $name)) { continue }
      $bounds = $element.Current.BoundingRectangle
      if ($bounds.IsEmpty) { continue }
      if ($bounds.Left -lt $minimumX -or $bounds.Left -gt $maximumX) { continue }
      if ($bounds.Top -lt $minimumY -or $bounds.Top -gt $maximumY) { continue }
      if ($bounds.Height -lt 8 -or $bounds.Height -gt 72) { continue }
      if ($bounds.Width -lt 8 -or $bounds.Width -gt ($window.Width * 0.7)) { continue }
      $controlType = $element.Current.ControlType.ProgrammaticName
      $score = 0
      if ($controlType -eq 'ControlType.Text') { $score += 30 }
      if ($controlType -eq 'ControlType.Edit') { $score -= 30 }
      $score += [math]::Max(0, 24 - [math]::Abs($bounds.Top - ($window.Top + 72)))
      $score += [math]::Max(0, 20 - (($bounds.Left - $minimumX) / 12))
      $candidates.Add([pscustomobject]@{
        Title = $name
        Score = $score
        Left = $bounds.Left
        Top = $bounds.Top
      })
    } catch {
      # UI Automation can invalidate individual elements while Weixin redraws.
    }
  }
  $best = $candidates |
    Sort-Object @{ Expression = 'Score'; Descending = $true }, @{ Expression = 'Left'; Descending = $false } |
    Select-Object -First 1
  $bestTitle = ''
  if ($null -ne $best) { $bestTitle = $best.Title }
  return [pscustomobject]@{
    Title = $bestTitle
    Count = $candidates.Count
  }
}

function Save-HeaderScreenshot($window, [string]$targetPath) {
  $cropX = $window.Left + [math]::Max(110, [math]::Round($window.Width * 0.15))
  $cropY = $window.Top + 28
  $cropWidth = [math]::Max(240, [math]::Round($window.Width * 0.72))
  $cropWidth = [math]::Min($cropWidth, $window.Right - $cropX - 30)
  $cropHeight = [math]::Min(108, [math]::Round($window.Height * 0.16))
  $bitmap = New-Object System.Drawing.Bitmap $cropWidth, $cropHeight
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.CopyFromScreen(
      (New-Object System.Drawing.Point $cropX, $cropY),
      [System.Drawing.Point]::Empty,
      (New-Object System.Drawing.Size $cropWidth, $cropHeight)
    )
    $bitmap.Save($targetPath, [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $graphics.Dispose()
    $bitmap.Dispose()
  }
}

function Await-WinRt($operation, [Type]$resultType) {
  $method = [System.WindowsRuntimeSystemExtensions].GetMethods() |
    Where-Object {
      $_.Name -eq 'AsTask' -and
      $_.IsGenericMethod -and
      $_.GetGenericArguments().Count -eq 1 -and
      $_.GetParameters().Count -eq 1
    } |
    Select-Object -First 1
  if ($null -eq $method) { throw 'WINRT_AS_TASK_UNAVAILABLE' }
  $task = $method.MakeGenericMethod($resultType).Invoke($null, @($operation))
  $task.Wait()
  return $task.Result
}

function Get-TitleFromWindowsOcr($window, [string]$screenshotPath) {
  Add-Type -AssemblyName System.Runtime.WindowsRuntime
  $null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
  $null = [Windows.Storage.Streams.IRandomAccessStream, Windows.Storage.Streams, ContentType = WindowsRuntime]
  $null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType = WindowsRuntime]
  $null = [Windows.Graphics.Imaging.SoftwareBitmap, Windows.Graphics.Imaging, ContentType = WindowsRuntime]
  $null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
  $null = [Windows.Media.Ocr.OcrResult, Windows.Foundation, ContentType = WindowsRuntime]

  Save-HeaderScreenshot $window $screenshotPath
  $file = Await-WinRt (
    [Windows.Storage.StorageFile]::GetFileFromPathAsync($screenshotPath)
  ) ([Windows.Storage.StorageFile])
  $stream = Await-WinRt (
    $file.OpenAsync([Windows.Storage.FileAccessMode]::Read)
  ) ([Windows.Storage.Streams.IRandomAccessStream])
  try {
    $decoder = Await-WinRt (
      [Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)
    ) ([Windows.Graphics.Imaging.BitmapDecoder])
    $softwareBitmap = Await-WinRt (
      $decoder.GetSoftwareBitmapAsync()
    ) ([Windows.Graphics.Imaging.SoftwareBitmap])
    try {
      $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
      if ($null -eq $engine) { return [pscustomobject]@{ Title = ''; Count = 0 } }
      $ocrResult = Await-WinRt (
        $engine.RecognizeAsync($softwareBitmap)
      ) ([Windows.Media.Ocr.OcrResult])
      $candidates = New-Object System.Collections.Generic.List[object]
      foreach ($line in $ocrResult.Lines) {
        $title = Normalize-ConversationTitle $line.Text
        if (-not (Test-ConversationTitle $title)) { continue }
        $words = @($line.Words)
        if (-not $words.Count) { continue }
        $rect = $words[0].BoundingRect
        if ($rect.Y -gt 88 -or $rect.X -lt 0) { continue }
        $candidates.Add([pscustomobject]@{
          Title = $title
          Left = $rect.X
          Top = $rect.Y
        })
      }
      $best = $candidates |
        Sort-Object @{ Expression = 'Left'; Descending = $false }, @{ Expression = 'Top'; Descending = $false } |
        Select-Object -First 1
      $bestTitle = ''
      if ($null -ne $best) { $bestTitle = $best.Title }
      return [pscustomobject]@{
        Title = $bestTitle
        Count = $candidates.Count
      }
    } finally {
      if ($null -ne $softwareBitmap) { $softwareBitmap.Dispose() }
    }
  } finally {
    $stream.Dispose()
  }
}

$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
$temporaryScreenshot = ''
try {
  $window = Show-WeixinWindow
  if ($null -eq $window) {
    Write-Result 'WEIXIN_MAIN_WINDOW_NOT_READY' '没有找到已登录的微信窗口，请先打开微信聊天窗口' '' 'none' 0 $stopwatch.ElapsedMilliseconds
    exit 3
  }

  $automation = Get-TitleFromAutomation $window
  if ($automation.Title) {
    Write-Result 'SUCCESS' "已识别当前微信会话“$($automation.Title)”" $automation.Title 'uia' $automation.Count $stopwatch.ElapsedMilliseconds
    exit 0
  }

  $artifactDirectory = if ($ArtifactRoot) {
    Join-Path $ArtifactRoot (Get-Date -Format 'yyyyMMdd-HHmmss-fff')
  } else {
    Join-Path ([System.IO.Path]::GetTempPath()) ('grainprint-wechat-' + [guid]::NewGuid().ToString('N'))
  }
  [void](New-Item -ItemType Directory -Force -Path $artifactDirectory)
  $temporaryScreenshot = Join-Path $artifactDirectory 'current-conversation-header.png'
  $ocr = Get-TitleFromWindowsOcr $window $temporaryScreenshot
  if ($ocr.Title) {
    Write-Result 'SUCCESS' "已识别当前微信会话“$($ocr.Title)”" $ocr.Title 'windows-ocr' $ocr.Count $stopwatch.ElapsedMilliseconds
    exit 0
  }

  Write-Result 'TARGET_NOT_FOUND' '没有识别到当前微信好友名称，请确认微信聊天窗口已打开并显示聊天标题' '' 'uia+windows-ocr' ($automation.Count + $ocr.Count) $stopwatch.ElapsedMilliseconds
  exit 2
} catch {
  Write-Result 'AUTOMATION_FAILED' 'Windows 微信当前会话识别失败，请保持微信聊天窗口打开后重试' '' 'failed' 0 $stopwatch.ElapsedMilliseconds
  exit 1
} finally {
  if (-not $ArtifactRoot -and $temporaryScreenshot) {
    Remove-Item -Force -ErrorAction SilentlyContinue $temporaryScreenshot
    Remove-Item -Force -ErrorAction SilentlyContinue (Split-Path $temporaryScreenshot -Parent)
  }
}
