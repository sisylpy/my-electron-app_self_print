param(
  [ValidateSet('Dock', 'Restore')][string]$Mode = 'Dock',
  [int]$X,
  [int]$Y,
  [int]$Width,
  [int]$Height
)

$ErrorActionPreference = 'Stop'

Add-Type @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class GrainPrintWeixinDock {
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc callback, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int command);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr hWnd, IntPtr after, int x, int y, int width, int height, uint flags);
  [DllImport("user32.dll")] public static extern void keybd_event(byte virtualKey, byte scanCode, uint flags, UIntPtr extraInfo);
  public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
}
'@

function Get-WeixinWindow {
  $processIds = @(
    Get-Process -Name Weixin, WeChatAppEx, WeChat -ErrorAction SilentlyContinue |
      Select-Object -ExpandProperty Id -Unique
  )
  if (-not $processIds.Count) { return $null }
  $windows = New-Object System.Collections.Generic.List[object]
  $callback = [GrainPrintWeixinDock+EnumWindowsProc]{
    param([IntPtr]$handle, [IntPtr]$parameter)
    [uint32]$processId = 0
    [void][GrainPrintWeixinDock]::GetWindowThreadProcessId($handle, [ref]$processId)
    if ($processIds -notcontains [int]$processId) { return $true }
    $rect = New-Object GrainPrintWeixinDock+RECT
    [void][GrainPrintWeixinDock]::GetWindowRect($handle, [ref]$rect)
    $width = $rect.Right - $rect.Left
    $height = $rect.Bottom - $rect.Top
    if ($width -lt 480 -or $height -lt 360) { return $true }
    $windows.Add([pscustomobject]@{
      Handle = $handle
      Visible = [GrainPrintWeixinDock]::IsWindowVisible($handle)
      Left = $rect.Left
      Top = $rect.Top
      Width = $width
      Height = $height
    })
    return $true
  }
  [void][GrainPrintWeixinDock]::EnumWindows($callback, [IntPtr]::Zero)
  return $windows |
    Sort-Object @{ Expression = 'Visible'; Descending = $true }, @{ Expression = { $_.Width * $_.Height }; Descending = $true } |
    Select-Object -First 1
}

function Show-WeixinWindow {
  $window = Get-WeixinWindow
  if ($null -eq $window) { return $null }
  if (-not $window.Visible) {
    [GrainPrintWeixinDock]::keybd_event(0x11, 0, 0, [UIntPtr]::Zero)
    [GrainPrintWeixinDock]::keybd_event(0x12, 0, 0, [UIntPtr]::Zero)
    [GrainPrintWeixinDock]::keybd_event(0x57, 0, 0, [UIntPtr]::Zero)
    Start-Sleep -Milliseconds 80
    [GrainPrintWeixinDock]::keybd_event(0x57, 0, 0x0002, [UIntPtr]::Zero)
    [GrainPrintWeixinDock]::keybd_event(0x12, 0, 0x0002, [UIntPtr]::Zero)
    [GrainPrintWeixinDock]::keybd_event(0x11, 0, 0x0002, [UIntPtr]::Zero)
    Start-Sleep -Milliseconds 500
    $window = Get-WeixinWindow
  }
  if ($null -ne $window) { [void][GrainPrintWeixinDock]::ShowWindow($window.Handle, 9) }
  return $window
}

if ($Width -lt 320 -or $Height -lt 320) { throw 'INVALID_DOCK_BOUNDS' }
$window = Show-WeixinWindow
if ($null -eq $window) { throw 'WECHAT_MAIN_WINDOW_NOT_FOUND' }
$old = "$($window.Left),$($window.Top),$($window.Width),$($window.Height)"
[void][GrainPrintWeixinDock]::SetWindowPos($window.Handle, [IntPtr]::Zero, $X, $Y, $Width, $Height, 0x0004)
if ($Mode -eq 'Dock') { [void][GrainPrintWeixinDock]::SetForegroundWindow($window.Handle) }
$old
