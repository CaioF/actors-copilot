#!/usr/bin/env node
// Signed-out form checks; never submits credentials or requests a reset email.
import puppeteer from 'puppeteer-core';

const chrome = process.env.AC_CHROME_PATH;
let base;
try {
  base = new URL(process.env.AC_BASE_URL || 'http://localhost:3000');
  const local = base.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);
  if (!chrome || !(base.protocol === 'https:' || local) || base.username || base.password || base.pathname !== '/' || base.search || base.hash) throw new Error();
} catch {
  console.error('Set AC_CHROME_PATH and use an HTTPS or local HTTP AC_BASE_URL origin.');
  process.exit(2);
}

const browser = await puppeteer.launch({executablePath:chrome, headless:true});
try {
  const page = await browser.newPage();
  await page.setViewport(process.env.AC_MOBILE === '1' ? {width:390,height:844} : {width:1440,height:900});
  let authPosts = 0;
  page.on('request', request => {
    const url = new URL(request.url());
    if (request.method() === 'POST' && (url.hostname === 'identitytoolkit.googleapis.com' || url.pathname === '/api/auth/callback')) authPosts++;
  });
  await page.goto(new URL('/login', base).href, {waitUntil:'domcontentloaded'});
  await page.locator('button ::-p-text(Forgot password?)').setTimeout(30000).wait();
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some(e => e.textContent.includes('Forgot password?') && !e.disabled), {timeout:30000});
  await page.locator('button ::-p-text(Forgot password?)').click();
  await page.waitForFunction(() => document.body.innerText.includes('Please enter your email address above, then try again.'));
  await page.locator('button[type="button"] ::-p-text(Create Account)').click();
  await page.waitForFunction(() => document.body.innerText.includes('14-Day Free Trial') && !document.body.innerText.includes('Please enter your email address above, then try again.'));
  await page.locator('button[type="button"] ::-p-text(Log In)').click();
  await page.locator('button ::-p-text(Forgot password?)').wait();
  const password = 'input[placeholder="••••••••••••"]';
  await page.locator(password).fill('synthetic-local-only');
  await page.$eval(password, e => e.parentElement.querySelector('button').click());
  await page.waitForFunction(selector => document.querySelector(selector)?.type === 'text', {}, password);
  await page.$eval(password, e => e.parentElement.querySelector('button').click());
  await page.waitForFunction(selector => document.querySelector(selector)?.type === 'password', {}, password);
  if (authPosts) throw new Error('Unexpected auth request during form controls check');
  console.log(JSON.stringify({journey:'signed-out-login-controls', blankResetValidation:true, modeSwitchClearedError:true, passwordVisibility:true, authPosts}));
} finally {
  await browser.close();
}
