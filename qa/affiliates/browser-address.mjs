import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

// Chrome's address bar is outside the page. Only type into the dedicated QA
// browser, after checking the foreground process. The referral is copied from
// the native admin cell if an older deployment displays it as plain text.
export async function navigateAddress(page, address, pasted = false) {
  const url = new URL(address);
  assert(['/login', '/admin-dashboard', '/api/admin/affiliate-qa'].includes(url.pathname));
  await page.bringToFront();
  const browser = page.context().browser();
  const cdp = await browser.newBrowserCDPSession();
  let pid;
  try {
    const { processInfo } = await cdp.send('SystemInfo.getProcessInfo');
    pid = processInfo.find((p) => p.type === 'browser')?.id;
  } finally {
    await cdp.detach();
  }
  assert(Number.isSafeInteger(pid));
  if (process.platform === 'win32') {
    const command = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class QAWindow {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
  [DllImport("user32.dll")] static extern bool AttachThreadInput(uint first, uint second, bool attach);
  [DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();
  [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr handle, int command);
  [DllImport("user32.dll")] static extern bool BringWindowToTop(IntPtr handle);
  [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr handle);
  public static void Activate(IntPtr handle) {
    uint pid;
    uint foreground = GetWindowThreadProcessId(GetForegroundWindow(), out pid);
    uint current = GetCurrentThreadId();
    bool attached = foreground != 0 && current != foreground && AttachThreadInput(current,foreground,true);
    try { ShowWindow(handle,9); BringWindowToTop(handle); SetForegroundWindow(handle); }
    finally { if(attached) AttachThreadInput(current,foreground,false); }
  }
}
"@
$qaShell = New-Object -ComObject WScript.Shell
$qaBrowserPid = [int]$env:QA_CHROME_PID
$qaHandle = (Get-Process -Id $qaBrowserPid).MainWindowHandle
if ($qaHandle -eq [IntPtr]::Zero) { throw 'QA browser has no window' }
[QAWindow]::Activate($qaHandle)
Start-Sleep -Milliseconds 200
function Test-QAFocus { [uint32]$qaWindowPid = 0; $null = [QAWindow]::GetWindowThreadProcessId([QAWindow]::GetForegroundWindow(), [ref]$qaWindowPid); return $qaWindowPid -eq $qaBrowserPid }
if (-not (Test-QAFocus)) { throw 'QA browser window is not focused' }
$qaShell.SendKeys('^l')
Start-Sleep -Milliseconds 140
if (-not (Test-QAFocus)) { throw 'QA browser lost focus' }
if ($env:QA_PASTE_ADDRESS -eq '1') { $qaShell.SendKeys('^v') } else { $qaShell.SendKeys($env:QA_PUBLIC_ADDRESS) }
Start-Sleep -Milliseconds 180
if (-not (Test-QAFocus)) { throw 'QA browser lost focus' }
$qaShell.SendKeys('{ENTER}')
`;
    // Only public navigation destinations enter the address bar. No credentials or hosted checkout URLs.
    execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], {
      env: {
        ...process.env,
        QA_CHROME_PID: String(pid),
        QA_PASTE_ADDRESS: pasted ? '1' : '0',
        QA_PUBLIC_ADDRESS: address,
      },
      stdio: ['ignore', 'ignore', 'pipe'],
      windowsHide: true,
      timeout: 12000,
    });
  } else if (process.platform === 'linux') {
    const x = (args) => execFileSync('xdotool', args, { encoding: 'utf8' }).trim();
    assert.equal(Number(x(['getactivewindow', 'getwindowpid'])), pid, 'QA browser must have focus in X11');
    x(['key', '--clearmodifiers', 'ctrl+l']);
    if (pasted) x(['key', '--clearmodifiers', 'ctrl+v']);
    else x(['type', '--clearmodifiers', '--', address]);
    x(['key', 'Return']);
  } else throw Error('This recording requires Windows or an X11 desktop with xdotool.');
  await page.waitForURL(address, { waitUntil: 'domcontentloaded', timeout: 90000 });
}
