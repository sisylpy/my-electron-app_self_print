param(
  [Parameter(Mandatory = $true)]
  [UInt64]$WindowHandle
)

$ErrorActionPreference = 'Stop'

Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class GrainPrintWindowFocus {
  [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
  [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint sourceThreadId, uint targetThreadId, bool attach);
  [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int command);
  [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern IntPtr SetActiveWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern IntPtr SetFocus(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr hWnd, IntPtr after, int x, int y, int width, int height, uint flags);
}
'@

$target = [IntPtr]::new([Int64]$WindowHandle)
if (-not [GrainPrintWindowFocus]::IsWindow($target)) { throw 'APP_WINDOW_NOT_FOUND' }

$foreground = [GrainPrintWindowFocus]::GetForegroundWindow()
[uint32]$foregroundProcessId = 0
[uint32]$targetProcessId = 0
$foregroundThread = [GrainPrintWindowFocus]::GetWindowThreadProcessId(
  $foreground,
  [ref]$foregroundProcessId
)
$targetThread = [GrainPrintWindowFocus]::GetWindowThreadProcessId(
  $target,
  [ref]$targetProcessId
)
$currentThread = [GrainPrintWindowFocus]::GetCurrentThreadId()
$attachedForeground = $false
$attachedTarget = $false
try {
  if ($foregroundThread -and $foregroundThread -ne $currentThread) {
    $attachedForeground = [GrainPrintWindowFocus]::AttachThreadInput(
      $currentThread,
      $foregroundThread,
      $true
    )
  }
  if ($targetThread -and $targetThread -ne $currentThread) {
    $attachedTarget = [GrainPrintWindowFocus]::AttachThreadInput(
      $currentThread,
      $targetThread,
      $true
    )
  }
  [void][GrainPrintWindowFocus]::ShowWindow($target, 9)
  [void][GrainPrintWindowFocus]::SetWindowPos(
    $target,
    [IntPtr]::Zero,
    0,
    0,
    0,
    0,
    0x0043
  )
  [void][GrainPrintWindowFocus]::BringWindowToTop($target)
  [void][GrainPrintWindowFocus]::SetForegroundWindow($target)
  [void][GrainPrintWindowFocus]::SetActiveWindow($target)
  [void][GrainPrintWindowFocus]::SetFocus($target)
} finally {
  if ($attachedTarget) {
    [void][GrainPrintWindowFocus]::AttachThreadInput($currentThread, $targetThread, $false)
  }
  if ($attachedForeground) {
    [void][GrainPrintWindowFocus]::AttachThreadInput($currentThread, $foregroundThread, $false)
  }
}

$active = [GrainPrintWindowFocus]::GetForegroundWindow()
if ($active -ne $target) { throw 'APP_WINDOW_FOCUS_DENIED' }
'FOCUSED'
