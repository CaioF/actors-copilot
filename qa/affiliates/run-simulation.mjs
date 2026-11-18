#!/usr/bin/env node
// Run only after the QA endpoint and its allowlists are deliberately enabled.
// Signs in off-camera and always attempts cleanup; it never sends card data.
import puppeteer from 'puppeteer-core';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';

const origin = process.env.AC_BASE_URL || 'https://app.theactorscopilot.com';
const {AC_ADMIN_USERNAME:username, AC_ADMIN_PASSWORD:password, AC_CHROME_PATH:chrome, AC_FFMPEG_PATH:ffmpeg, AC_QA_UID:uid, QA_SIMULATION_SECRET:key} = process.env;
const {AC_TEST_EMAIL:email, AC_TEST_PASSWORD:passwordForTest} = process.env;
const apiKey = process.env.AC_FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const source = process.env.AC_QA_SOURCE || 'link';
const affiliateCode = process.env.AC_QA_AFFILIATE || 'lucas';
if (!username || !password || !chrome || !ffmpeg || !uid || !email || !passwordForTest || !apiKey || !/^[a-f0-9]{64}$/i.test(key || '') || !['link','coupon'].includes(source) || new URL(origin).origin !== origin) throw new Error('Missing or invalid QA configuration');
const output = resolve('qa/affiliates/evidence');
await mkdir(output,{recursive:true});
const browser = await puppeteer.launch({executablePath:chrome,headless:true});
let recorder;
let runId;
let page;
let cleanupFailed = false;
try {
  page = await browser.newPage();
  await page.setViewport({width:1280,height:800});
  await page.goto(new URL('/admin-dashboard/affiliates',origin).href,{waitUntil:'domcontentloaded'});
  await page.locator('#admin-username').fill(username);
  await page.locator('#admin-password').fill(password);
  const [login] = await Promise.all([
    page.waitForResponse(r => new URL(r.url()).pathname === '/api/admin/login' && r.request().method() === 'POST',{timeout:30000}),
    page.locator('button ::-p-text(Log in)').click(),
  ]);
  if (!login.ok()) throw new Error('Admin login failed');
  await page.waitForFunction(code => [...document.querySelectorAll('tbody tr')].some(row => row.innerText.toLowerCase().includes(code)),{timeout:60000},affiliateCode);
  const call = async (method, body) => page.evaluate(async (method, body, secret) => {
    const response = await fetch('/api/admin/affiliate-qa',{method,headers:{'content-type':'application/json',authorization:`Bearer ${secret}`},body:JSON.stringify(body)});
    return {status:response.status, data:await response.json()};
  },method,body,key);
  const auth = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`, {
    method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({email,password:passwordForTest,returnSecureToken:true}),
  });
  if (!auth.ok) throw new Error('Test identity sign-in failed');
  const identity = await auth.json();
  if (identity.localId !== uid) throw new Error('Test identity does not match allowlisted UID');
  // Keep the ID before sending so cleanup is possible even if the response is lost.
  runId = randomUUID();
  const response = await call('POST',{uid,affiliateCode,source,runId,idToken:identity.idToken});
  if (response.status !== 200 || !response.data.simulated) {
    if ([400, 404, 409].includes(response.status)) runId = undefined; // Rejected before writes.
    throw new Error(`Simulation failed with HTTP ${response.status}`);
  }
  if (response.data.runId !== runId) throw new Error('Unexpected simulation identifier');
  if (!response.data.projectionUpdated) throw new Error('Admin member projection did not update');
  const callback = await fetch(new URL('/api/auth/callback',origin), {
    method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({idToken:identity.idToken}),
  });
  const session = await callback.json();
  const cookie = callback.headers.getSetCookie().find(value => value.startsWith('platform_session='));
  if (!callback.ok || !cookie || session.user?.tier !== 'economy' || session.user?.subscriptionStatus !== 'trialing') throw new Error('Simulated trial did not hydrate the expected session');
  await browser.setCookie({name:'platform_session',value:cookie.split(';',1)[0].slice('platform_session='.length),url:origin,httpOnly:true,secure:true,sameSite:'Lax'});
  const memberPage = await browser.newPage();
  await memberPage.goto(new URL('/login',origin).href,{waitUntil:'domcontentloaded'});
  await memberPage.locator('input[type="email"]').fill(email);
  await memberPage.locator('input[type="password"]').fill(passwordForTest);
  await memberPage.locator('button ::-p-text(Sign In)').click();
  await memberPage.waitForFunction(() => location.pathname !== '/login',{timeout:30000});
  await memberPage.goto(new URL('/auditions',origin).href,{waitUntil:'domcontentloaded'});
  await memberPage.waitForFunction(() => location.pathname === '/auditions' && !!document.querySelector('input[placeholder="Search auditions by project or role..."]'),{timeout:30000});
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(code => [...document.querySelectorAll('tbody tr')].some(row => row.innerText.toLowerCase().includes(code) && row.innerText.includes('simulated QA referral')),{timeout:60000},affiliateCode);
  await page.evaluate(code => {
    const rows = [...document.querySelectorAll('tbody tr')];
    const target = rows.find(row => row.innerText.toLowerCase().includes(code));
    const card = target.closest('[data-slot="card"]');
    for (const other of document.querySelectorAll('[data-slot="card"]')) if (other !== card) other.style.display='none';
    for (const row of rows) if (row !== target) row.style.display='none';
    for (const el of target.querySelectorAll('div,span')) if (!el.children.length && el.textContent.includes('@')) el.style.visibility='hidden';
    const cells = [...target.querySelectorAll('td')];
    cells[0].querySelector('div').textContent='Affiliate (redacted)';
    for (const badge of cells[0].querySelectorAll('[data-slot="badge"]')) badge.style.visibility='hidden';
    for (const node of cells[1].childNodes) if (node.nodeType === Node.TEXT_NODE) node.textContent='[Real totals redacted]';
    for (const cell of cells.slice(2)) cell.style.visibility='hidden';
  },affiliateCode);
  recorder = await page.screencast({path:`${output}/simulation-${source}.webm`,ffmpegPath:ffmpeg,fps:12});
  await page.evaluate(() => { document.querySelector('tbody tr:not([style*="display: none"])').style.outline='2px solid #e8721a'; });
  await page.mouse.move(850,360,{steps:10});
  await new Promise(resolve=>setTimeout(resolve,3000));
  await recorder.stop(); recorder=undefined;
  console.log(JSON.stringify({simulated:true,source,memberAccess:true,qaLabelVisible:true,realPayment:false}));
} catch (error) {
  console.error(`Simulation QA failed: ${error instanceof Error ? error.message : 'unknown error'}`);
  process.exitCode=1;
} finally {
  if (recorder) await recorder.stop();
  if (runId && page) {
    try {
      const cleanup = await page.evaluate(async (id, account, secret) => {
        const response=await fetch('/api/admin/affiliate-qa',{method:'DELETE',headers:{'content-type':'application/json',authorization:`Bearer ${secret}`},body:JSON.stringify({uid:account,runId:id})});
        const data=await response.json();
        return {ok:response.ok,projectionUpdated:data.projectionUpdated};
      },runId,uid,key);
      if (!cleanup.ok || !cleanup.projectionUpdated) cleanupFailed=true;
    } catch { cleanupFailed=true; }
    if (cleanupFailed) { console.error('QA cleanup did not complete; review the test account before retrying.'); process.exitCode=1; }
    else console.log(JSON.stringify({cleanupRestored:true}));
  }
  await browser.close();
}
