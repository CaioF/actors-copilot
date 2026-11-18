#!/usr/bin/env node
// Production QA: opens a checkout for an authorized account but never completes payment.
import puppeteer from 'puppeteer-core';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';

const origin = process.env.AC_BASE_URL || 'https://app.theactorscopilot.com';
const email = process.env.AC_TEST_EMAIL;
const password = process.env.AC_TEST_PASSWORD;
const chrome = process.env.AC_CHROME_PATH;
const apiKey = process.env.AC_FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const ffmpeg = process.env.AC_FFMPEG_PATH;
if (new URL(origin).origin !== origin || !email || !password || !chrome || !apiKey || !ffmpeg) throw new Error('Missing or invalid QA configuration');
const output = resolve('qa/affiliates/evidence');
await mkdir(output, {recursive:true});
const hold = () => new Promise(resolve => setTimeout(resolve, 1600));
const browser = await puppeteer.launch({executablePath:chrome, headless:true});
let recorder;
let stage = 'referral';
try {
  const page = await browser.newPage();
  await page.setViewport({width:1280,height:800});
  await page.goto(new URL('/login?ref=lucas', origin).href, {waitUntil:'domcontentloaded'});
  await page.waitForFunction(() => {
    try { return JSON.parse(localStorage.getItem('affiliate_attribution') || '{}').code === 'lucas'; } catch { return false; }
  }, {timeout:30000});
  recorder = await page.screencast({path:`${output}/01-referral.webm`, ffmpegPath:ffmpeg, fps:12});
  await page.evaluate(() => {
    const marker = document.createElement('div');
    marker.textContent = 'QA: la referencia lucas está guardada en este navegador aislado';
    Object.assign(marker.style, {position:'fixed',left:'16px',bottom:'16px',zIndex:'2147483647',padding:'12px',background:'#111',color:'#fff',font:'15px sans-serif'});
    document.body.append(marker);
  });
  await hold();
  await recorder.stop(); recorder = undefined;

  // Authenticate while recording is stopped; never print a credential or token.
  stage = 'session-setup';
  const auth = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`, {
    method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({email,password,returnSecureToken:true}),
  });
  if (!auth.ok) throw new Error('Firebase sign-in failed');
  const {idToken} = await auth.json();
  const callback = await fetch(new URL('/api/auth/callback', origin), {
    method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({idToken}),
  });
  const cookie = callback.headers.getSetCookie().find(value => value.startsWith('platform_session='));
  if (!callback.ok || !cookie) throw new Error('App session setup failed');
  await browser.setCookie({name:'platform_session',value:cookie.split(';',1)[0].slice('platform_session='.length),url:origin,httpOnly:true,secure:true,sameSite:'Lax'});
  stage = 'ui-sign-in';
  await page.goto(new URL('/login', origin).href, {waitUntil:'domcontentloaded'});
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button ::-p-text(Sign In)').click();
  await page.waitForFunction(() => location.pathname !== '/login', {timeout:30000});
  stage = 'plan';
  await page.goto(new URL('/upgrade', origin).href, {waitUntil:'domcontentloaded'});
  await page.locator('button ::-p-text(Upgrade to Economy Class)').setTimeout(30000).wait();
  recorder = await page.screencast({path:`${output}/02-plan.webm`, ffmpegPath:ffmpeg, fps:12});
  await page.locator('button ::-p-text(Annual)').click();
  await page.waitForFunction(() => document.body.innerText.includes('/year'));
  await hold();
  await page.locator('button ::-p-text(Monthly)').click();
  await page.waitForFunction(() => document.body.innerText.includes('/month') && !document.body.innerText.includes('Billed annually.'));
  await page.mouse.move(700, 500, {steps:10});
  await hold();
  await recorder.stop(); recorder = undefined;

  // Opening a session can create or reuse a Stripe customer/session; no payment is submitted.
  stage = 'checkout';
  const [response] = await Promise.all([
    page.waitForResponse(r => new URL(r.url()).pathname === '/api/billing/checkout' && r.request().method() === 'POST', {timeout:60000}),
    page.locator('button ::-p-text(Upgrade to Economy Class)').click(),
  ]);
  if (!response.ok()) throw new Error(`Checkout creation returned HTTP ${response.status()}`);
  await page.waitForFunction(() => location.hostname === 'checkout.stripe.com', {timeout:60000});
  await page.waitForFunction(() => /15\.20|promo|coupon|discount/i.test(document.body?.innerText || ''), {timeout:60000});
  await page.evaluate(testEmail => {
    // Recording begins only after redaction; never capture entered payment details.
    const redact = () => {
      for (const el of document.querySelectorAll('input')) if (el.type === 'email' || el.value?.includes(testEmail)) el.style.filter = 'blur(10px)';
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) if (walker.currentNode.textContent?.includes(testEmail)) walker.currentNode.parentElement.style.filter = 'blur(10px)';
    };
    redact(); new MutationObserver(redact).observe(document.documentElement, {subtree:true,childList:true,characterData:true});
  }, email);
  await hold();
  recorder = await page.screencast({path:`${output}/03-checkout-redacted.webm`, ffmpegPath:ffmpeg, fps:12, crop:{x:0,y:0,width:640,height:800}});
  await hold();
  await hold();
  const facts = await page.evaluate(() => ({
    discountVisible:/lucas/i.test(document.body.innerText),
    amountVisible:document.body.innerText.includes('15.20'),
    trialVisible:/trial|prueba/i.test(document.body.innerText),
  }));
  await recorder.stop(); recorder = undefined;
  console.log(JSON.stringify({referralCaptured:true, checkoutCreated:true, ...facts, paymentSubmitted:false}));
} catch (error) {
  console.error(`QA failed at ${stage}: ${error instanceof Error ? error.message : 'unknown error'}`);
  process.exitCode = 1;
} finally {
  if (recorder) await recorder.stop();
  await browser.close();
}
