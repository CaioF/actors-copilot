#!/usr/bin/env node
// Log in off-camera; record only the requested affiliate's sanitized report row.
import puppeteer from 'puppeteer-core';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';

const origin = process.env.AC_BASE_URL || 'https://app.theactorscopilot.com';
const {AC_ADMIN_USERNAME:username, AC_ADMIN_PASSWORD:password, AC_CHROME_PATH:chrome, AC_FFMPEG_PATH:ffmpeg} = process.env;
if (!username || !password || !chrome || !ffmpeg || new URL(origin).origin !== origin) throw new Error('Missing or invalid admin QA configuration');
const output = resolve('qa/affiliates/evidence');
await mkdir(output, {recursive:true});
const browser = await puppeteer.launch({executablePath:chrome,headless:true});
let recorder;
try {
  const page = await browser.newPage();
  await page.setViewport({width:1280,height:800});
  await page.goto(new URL('/admin-dashboard/affiliates',origin).href, {waitUntil:'domcontentloaded'});
  await page.locator('#admin-username').fill(username);
  await page.locator('#admin-password').fill(password);
  const [response] = await Promise.all([
    page.waitForResponse(r => new URL(r.url()).pathname === '/api/admin/login' && r.request().method() === 'POST', {timeout:30000}),
    page.locator('button ::-p-text(Log in)').click(),
  ]);
  if (!response.ok()) throw new Error(`Admin login returned HTTP ${response.status()}`);
  await page.waitForFunction(() => [...document.querySelectorAll('tbody tr')].some(row => /\blucas\b/i.test(row.innerText)), {timeout:60000});
  const result = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('tbody tr')];
    const target = rows.find(row => /\blucas\b/i.test(row.innerText));
    const text = target.innerText;
    const cells = [...target.querySelectorAll('td')];
    const card = target.closest('[data-slot="card"]');
    for (const other of document.querySelectorAll('[data-slot="card"]')) if (other !== card) other.style.display = 'none';
    for (const row of rows) if (row !== target) row.style.display = 'none';
    for (const el of target.querySelectorAll('div,span')) if (el.children.length === 0 && el.textContent.includes('@')) el.style.visibility = 'hidden';
    // The repository is public: do not publish live counts or money amounts.
    const firstCell = cells[0];
    firstCell.querySelector('div').textContent = 'Affiliate (redacted)';
    for (const badge of firstCell.querySelectorAll('[data-slot="badge"]')) badge.style.visibility = 'hidden';
    for (const cell of cells.slice(1)) cell.style.visibility = 'hidden';
    return {couponVisible:/Coupon code:\s*LUCAS/i.test(text), referralLinkVisible:/\/login\?ref=lucas/i.test(text)};
  });
  recorder = await page.screencast({path:`${output}/04-admin-lucas.webm`,ffmpegPath:ffmpeg,fps:12});
  await page.mouse.move(320, 360);
  await page.evaluate(() => { document.querySelector('tbody tr:not([style*="display: none"])').style.outline = '2px solid #e8721a'; });
  await new Promise(resolve => setTimeout(resolve,1500));
  await page.mouse.move(800, 360, {steps:10});
  await new Promise(resolve => setTimeout(resolve,1500));
  await recorder.stop(); recorder=undefined;
  console.log(JSON.stringify({journey:'admin-affiliate-row', ...result, sanitized:true}));
} catch (error) {
  console.error(`Admin QA failed: ${error instanceof Error ? error.message : 'unknown error'}`);
  process.exitCode=1;
} finally {
  if (recorder) await recorder.stop();
  await browser.close();
}
