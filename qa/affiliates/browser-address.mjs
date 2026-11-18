import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

// Chrome's address bar is outside the page. Only type into the dedicated QA
// browser, after checking the foreground process. The referral is copied from
// the native admin cell if an older deployment displays it as plain text.
export async function navigateAddress(page, address, pasted = false) {
  const url = new URL(address);
  assert(['/login', '/dashboard', '/admin-dashboard', '/api/admin/affiliate-qa'].includes(url.pathname));
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
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$qaShell = New-Object -ComObject WScript.Shell
$qaBrowserPid = [int]$env:QA_CHROME_PID
$qaHandle = (Get-Process -Id $qaBrowserPid).MainWindowHandle
if ($qaHandle -eq [IntPtr]::Zero) { throw 'QA browser has no window' }
function Test-QAFocus { [uint32]$qaWindowPid = 0; $null = [QAWindow]::GetWindowThreadProcessId([QAWindow]::GetForegroundWindow(), [ref]$qaWindowPid); return $qaWindowPid -eq $qaBrowserPid }
for ($attempt = 0; $attempt -lt 5; $attempt++) {
  [QAWindow]::Activate($qaHandle)
  Start-Sleep -Milliseconds 200
  if (Test-QAFocus) { break }
}
if (-not (Test-QAFocus)) { throw 'QA browser window is not focused' }
$qaShell.SendKeys('^l')
$addressBar = $null
for ($attempt = 0; $attempt -lt 20; $attempt++) {
  Start-Sleep -Milliseconds 100
  if (-not (Test-QAFocus)) { throw 'QA browser lost focus' }
  $focused = [System.Windows.Automation.AutomationElement]::FocusedElement
  if ($focused -and $focused.Current.ProcessId -eq $qaBrowserPid -and
      $focused.Current.ControlType -eq [System.Windows.Automation.ControlType]::Edit -and
      $focused.Current.Name -match '^Address (and search )?bar$') {
    $addressBar = $focused
    break
  }
}
if (-not $addressBar) { throw 'The QA address bar is not focused' }
$addressValue = $addressBar.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)
if ($env:QA_PASTE_ADDRESS -eq '1') {
  $qaShell.SendKeys('^v')
  Start-Sleep -Milliseconds 100
} else {
  $addressValue.SetValue($env:QA_PUBLIC_ADDRESS)
}
if (-not (Test-QAFocus)) { throw 'QA browser lost focus' }
for ($attempt = 0; $attempt -lt 15 -and $addressValue.Current.Value -cne $env:QA_PUBLIC_ADDRESS; $attempt++) {
  Start-Sleep -Milliseconds 100
}
if ($addressValue.Current.Value -cne $env:QA_PUBLIC_ADDRESS) { throw 'The address bar does not contain the intended URL' }
if (-not (Test-QAFocus)) { throw 'QA browser lost focus' }
$qaShell.SendKeys('{ENTER}')
`;
    // Only public navigation destinations enter the address bar. No credentials or hosted checkout URLs.
    for (let attempt = 0; attempt < 2 && page.url() !== address; attempt++) {
      try {
        await page.bringToFront();
        execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], {
          env: {
            ...process.env,
            QA_CHROME_PID: String(pid),
            QA_PASTE_ADDRESS: pasted ? '1' : '0',
            QA_PUBLIC_ADDRESS: address,
          },
          stdio: ['ignore', 'ignore', 'pipe'],
          windowsHide: true,
          timeout: 30000,
        });
        break;
      } catch (error) {
        if (attempt === 1) {
          const reason = error.code === 'ETIMEDOUT' ? 'timed out' : 'could not verify native browser focus or the address';
          throw new Error('Chrome address bar ' + reason);
        }
      }
    }
  } else if (process.platform === 'linux') {
    const x = (args) => execFileSync('xdotool', args, { encoding: 'utf8' }).trim();
    assert.equal(Number(x(['getactivewindow', 'getwindowpid'])), pid, 'QA browser must have focus in X11');
    x(['key', '--clearmodifiers', 'ctrl+l']);
    if (pasted) x(['key', '--clearmodifiers', 'ctrl+v']);
    else x(['type', '--clearmodifiers', '--', address]);
    x(['key', 'Return']);
  } else throw Error('This recording requires Windows or an X11 desktop with xdotool.');
  await page.waitForURL(actual => actual.href === address ||
    (url.pathname === '/dashboard' && actual.origin === url.origin && actual.pathname === '/start-trial'),
  { waitUntil: 'domcontentloaded', timeout: 90000 });
}
