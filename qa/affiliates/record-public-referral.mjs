#!/usr/bin/env node
// Captures an anonymous referral in an isolated browser; no account is created.
import puppeteer from 'puppeteer-core';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const origin = process.env.AC_BASE_URL || 'https://app.theactorscopilot.com';
const chrome = process.env.AC_CHROME_PATH;
const ffmpeg = process.env.AC_FFMPEG_PATH;
if (!chrome || !ffmpeg || new URL(origin).origin !== origin) throw new Error('Missing QA configuration');
const output = resolve('qa/affiliates/evidence');
await mkdir(output,{recursive:true});
const browser = await puppeteer.launch({executablePath:chrome,headless:true});
let recorder;
try {
  const page = await browser.newPage();
  await page.setViewport({width:1280,height:800});
  await page.goto(new URL('/login?ref=lucas',origin).href,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(() => {
    try { return JSON.parse(localStorage.getItem('affiliate_attribution') || '{}').code === 'lucas'; } catch { return false; }
  },{timeout:30000});
  await page.evaluate(() => {
    const note=document.createElement('div');
    note.textContent='QA: el navegador aislado capturó la referencia lucas';
    Object.assign(note.style,{position:'fixed',left:'16px',bottom:'16px',zIndex:'2147483647',padding:'12px',background:'#111',color:'#fff',font:'15px sans-serif'});
    document.body.append(note);
  });
  recorder=await page.screencast({path:`${output}/01-referral.webm`,ffmpegPath:ffmpeg,fps:12});
  await page.locator('button[type="button"] ::-p-text(Log In)').click();
  await new Promise(resolve=>setTimeout(resolve,1500));
  await page.locator('button[type="button"] ::-p-text(Create Account)').click();
  await new Promise(resolve=>setTimeout(resolve,1500));
  await page.mouse.move(620,400,{steps:8});
  await new Promise(resolve=>setTimeout(resolve,1000));
  await recorder.stop(); recorder=undefined;
  console.log(JSON.stringify({journey:'public-referral',referralCaptured:true,accountCreated:false}));
} finally {
  if (recorder) await recorder.stop();
  await browser.close();
}
