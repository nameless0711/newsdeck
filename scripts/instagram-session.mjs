import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

export function instagramCookies(cookies, now = Date.now() / 1000) {
  const names = new Set(['sessionid', 'ds_user_id', 'csrftoken']);
  return cookies.filter(c => names.has(c.name) && ['instagram.com', '.instagram.com', 'www.instagram.com'].includes(c.domain)
    && c.secure && (c.expires === -1 || c.expires > now));
}
export function hasSession(cookies) {
  return ['sessionid', 'ds_user_id'].every(name => cookies.some(c => c.name === name && c.value));
}
// Only the current Windows account can decrypt this file. Secrets travel through pipes.
export async function crypt(value, decrypt = false) {
  if (process.platform !== 'win32') throw new Error('Dieser Prototyp benötigt Windows-Datenschutz (DPAPI).');
  const script = `Add-Type -AssemblyName System.Security; $v=[Console]::In.ReadToEnd(); $b=${decrypt ? '[Convert]::FromBase64String($v)' : '[Text.Encoding]::UTF8.GetBytes($v)'}; $r=[Security.Cryptography.ProtectedData]::${decrypt ? 'Unprotect' : 'Protect'}($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Write(${decrypt ? '[Text.Encoding]::UTF8.GetString($r)' : '[Convert]::ToBase64String($r)'});`;
  return new Promise((ok, fail) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let output = ''; child.stdout.on('data', chunk => output += chunk);
    child.stderr.resume(); child.on('error', fail);
    child.on('close', code => code === 0 ? ok(output) : fail(new Error('Geschützte Sitzung konnte nicht verarbeitet werden.')));
    child.stdin.on('error', () => {}); child.stdin.end(value);
  });
}

export async function main(mode = 'login') {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const dir = resolve(root, 'data/instagram');
  const session = resolve(dir, 'session.dpapi');
  const statusFile = resolve(dir, 'status.json');
  await mkdir(dir, { recursive: true });
  const status = async (state, extra = {}) => writeFile(statusFile, JSON.stringify({ state, checkedAt: new Date().toISOString(), ...extra }, null, 2));
  if (mode === 'disconnect') {
    await unlink(session).catch(e => { if (e.code !== 'ENOENT') throw e; });
    await status('disconnected'); return;
  }
  if (!['login', 'test', 'smoke'].includes(mode)) throw new Error('Unbekannter Modus.');
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ channel: 'msedge', headless: mode === 'smoke' });
  const context = await browser.newContext({ acceptDownloads: false });
  let closed = false; browser.on('disconnected', () => { closed = true; });
  try {
    if (mode === 'test') {
      const cookies = instagramCookies(JSON.parse(await crypt(await readFile(session, 'utf8'), true)));
      if (!hasSession(cookies)) throw new Error('Keine gültige lokale Sitzung. Bitte erneut anmelden.');
      await context.addCookies(cookies);
    }
    const page = await context.newPage();
    if (mode === 'smoke') {
      await page.goto('data:text/html,<title>NEWSDECK Anmeldetest</title>');
      await status('browser_test_passed'); return;
    }
    await status(mode === 'login' ? 'awaiting_login' : 'checking_session');
    await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    const deadline = Date.now() + (mode === 'login' ? 20 * 60 * 1000 : 30000);
    while (Date.now() < deadline && !closed) {
      const cookies = instagramCookies(await context.cookies('https://www.instagram.com/'));
      if (hasSession(cookies) && !/\/accounts\/login|\/challenge|\/checkpoint/.test(new URL(page.url()).pathname)) {
        await writeFile(session, await crypt(JSON.stringify(cookies)), { mode: 0o600 });
        await status('session_detected', { restoredSession: mode === 'test', authenticatedFetchVerified: false, message: 'Instagram-Sitzung erkannt und geschützt gespeichert. Kontoidentität und RSS-Abruf noch nicht verifiziert.' });
        return;
      }
      await new Promise(r => setTimeout(r, 1500));
    }
    await status(closed ? 'browser_closed' : 'login_required');
  } catch (error) {
    const code = String(error?.message).match(/net::ERR_[A-Z_]+/)?.[0] || (error?.name === 'TimeoutError' ? 'TIMEOUT' : 'LOCAL_ERROR');
    await status('error', { code, message: 'Anmeldetest fehlgeschlagen. Browser, Netzwerk oder lokale Sitzung prüfen.' });
    process.exitCode = 1;
  } finally { await browser.close().catch(() => {}); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv[2]).catch(() => { console.error('Instagram-Anmeldetest konnte nicht gestartet werden.'); process.exitCode = 1; });
}
