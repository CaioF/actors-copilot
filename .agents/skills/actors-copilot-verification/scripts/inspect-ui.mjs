#!/usr/bin/env node
// Disposable Chrome session. Credentials are supplied only through environment variables.
import puppeteer from 'puppeteer-core';
import {fileURLToPath} from 'node:url';

const origin = process.env.AC_BASE_URL || 'http://localhost:3000';
const chrome = process.env.AC_CHROME_PATH;
const email = process.env.AC_TEST_EMAIL;
const password = process.env.AC_TEST_PASSWORD;
const paths = process.argv.slice(2);
const viewport = process.env.AC_MOBILE === '1' ? {width:390, height:844} : {width:1440, height:900};
if (!chrome || !email || !password || !paths.length || paths.some(p => !p.startsWith('/') || p.startsWith('//'))) {
  console.error('Set AC_CHROME_PATH, AC_TEST_EMAIL and AC_TEST_PASSWORD; pass one or more relative paths.');
  process.exit(2);
}
const url = new URL(origin);
if (!(url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) || url.pathname !== '/' || url.username || url.password || url.search || url.hash) {
  console.error('AC_BASE_URL must be an HTTPS origin or a local HTTP origin.');
  process.exit(2);
}
if (paths.some(path => new URL(path, url).origin !== url.origin)) throw new Error('Paths must stay on the configured origin');
const browser = await puppeteer.launch({executablePath: chrome, headless: true});
try {
  console.log(JSON.stringify({origin:url.origin, browser:await browser.version(), viewport, sessionSeeded:process.env.AC_SEED_SESSION === '1'}));
  const page = await browser.newPage();
  await page.setViewport(viewport);
  const authResponses = {};
  page.on('response', response => {
    const responseUrl = new URL(response.url());
    if (responseUrl.origin === url.origin && responseUrl.pathname === '/api/auth/callback') {
      const key = `${response.request().method()} ${response.status()}`;
      authResponses[key] = (authResponses[key] || 0) + 1;
    }
  });
  if (process.env.AC_SEED_SESSION === '1') {
    const apiKey = process.env.AC_FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    if (!apiKey) throw new Error('AC_FIREBASE_API_KEY is required for session seeding');
    const auth = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST', headers: {'content-type': 'application/json'},
      body: JSON.stringify({email, password, returnSecureToken: true}),
    });
    if (!auth.ok) throw new Error(`Firebase sign-in failed: ${auth.status}`);
    const {idToken} = await auth.json();
    const response = await fetch(new URL('/api/auth/callback', url), {
      method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({idToken}),
    });
    const cookie = response.headers.getSetCookie().find(value => value.startsWith('platform_session='));
    if (!response.ok || !cookie) throw new Error('Session callback did not return a platform cookie');
    const value = cookie.split(';', 1)[0].slice('platform_session='.length);
    await browser.setCookie({name: 'platform_session', value, url: url.origin, httpOnly: true, secure: url.protocol === 'https:', sameSite: 'Lax'});
    console.error('Session seeded through Firebase and the app callback; this does not verify the ordinary login journey.');
  }
  await page.goto(new URL('/login', url).href, {waitUntil: 'domcontentloaded'});
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button ::-p-text(Sign In)').click();
  try {
    await page.waitForFunction(() => location.pathname !== '/login', {timeout: 30000});
  } catch (error) {
    console.error(JSON.stringify({journey:'login', finalPath:new URL(page.url()).pathname, authResponses}));
    throw error;
  }
  for (const path of paths) {
    await page.goto(new URL(path, url).href, {waitUntil: 'domcontentloaded'});
    // The interior auth guard initially renders a branded loading screen.
    if (new URL(page.url()).pathname !== '/chat') await page.waitForSelector('main', {visible: true, timeout: 30000});
    else await page.waitForSelector('textarea, [contenteditable="true"]', {timeout: 30000});
    if (path === '/auditions/new/sides') await page.waitForFunction(() => !document.body.innerText.includes('Loading your saved auditions...'), {timeout:30000});
    const view = await page.evaluate(() => ({
      path: location.pathname,
      title: document.title,
      headings: [...document.querySelectorAll('h1,h2,h3')].map(e => e.innerText.trim()).filter(Boolean),
      buttons: [...document.querySelectorAll('button')].filter(e => e.getClientRects().length).map(e => (e.getAttribute('aria-label') || e.innerText).trim()).filter(Boolean),
      fields: [...document.querySelectorAll('input,textarea,select')].filter(e => e.getClientRects().length).map(e => ({tag:e.tagName.toLowerCase(), type:e.getAttribute('type'), label:e.getAttribute('aria-label'), placeholder:e.getAttribute('placeholder')})),
      links: [...document.querySelectorAll('a[href]')].filter(e => e.getClientRects().length).map(e => ({label:(e.getAttribute('aria-label') || e.innerText).trim(), href:e.getAttribute('href')})).filter(e => e.label),
    }));
    console.log(JSON.stringify({requested: path, ...view}));
    if (process.env.AC_CHECK_BASELINE_SHORT === '1' && path === '/dashboard') {
      const draft = 'Synthetic short text.';
      const input = 'textarea[placeholder="Paste your details here..."]';
      await page.locator('button ::-p-text(Upload Baseline)').click();
      await page.locator(input).fill(draft);
      const [response] = await Promise.all([
        page.waitForResponse(r => new URL(r.url()).origin === url.origin && new URL(r.url()).pathname === '/api/dna/baseline' && r.request().method() === 'POST', {timeout:30000}),
        page.locator('button ::-p-text(Save Baseline)').click(),
      ]);
      const body = await response.json();
      await page.waitForFunction(() => document.body.innerText.includes("Couldn't save your baseline"), {timeout:30000});
      const result = await page.evaluate(() => ({
        fileMessage: document.body.innerText.includes("We couldn't read that file"),
        shortMessage: /too short|at least 50 characters/i.test(document.body.innerText),
        draftRetained: document.querySelector('textarea[placeholder="Paste your details here..."]')?.value === 'Synthetic short text.',
      }));
      const serverSaysTooShort = typeof body.error === 'string' && /too short/i.test(body.error);
      console.log(JSON.stringify({journey:'baseline-short', status:response.status(), serverSaysTooShort, ...result}));
      if (response.status() !== 400 || !serverSaysTooShort || !result.draftRetained || !result.shortMessage) throw new Error('Short baseline was not explained correctly');
    }
    if (process.env.AC_CHECK_BASELINE_FORM === '1' && path === '/dashboard') {
      let submissions = 0;
      const countBaseline = request => {
        const target = new URL(request.url());
        if (target.origin === url.origin && target.pathname === '/api/dna/baseline' && request.method() === 'POST') submissions++;
      };
      page.on('request', countBaseline);
      const textarea = 'textarea[placeholder="Paste your details here..."]';
      await page.locator('button ::-p-text(Upload Baseline)').click();
      await page.locator('h2 ::-p-text(Upload Your Baseline History)').wait();
      const saveButton = await page.locator('button ::-p-text(Save Baseline)').waitHandle();
      if (!await saveButton.evaluate(e => e.disabled)) throw new Error('Empty baseline form should not be submittable');
      await page.locator(textarea).fill('Synthetic baseline draft for verification.');
      await page.waitForFunction(() => [...document.querySelectorAll('button')].some(e => e.textContent.trim() === 'Save Baseline' && !e.disabled));
      await page.locator('button ::-p-text(Cancel)').click();
      await page.waitForFunction(() => ![...document.querySelectorAll('h2')].some(e => e.textContent.includes('Upload Your Baseline History')));
      await page.locator('button ::-p-text(Upload Baseline)').click();
      await page.waitForSelector(textarea, {visible:true});
      if (await page.$eval(textarea, e => e.value)) throw new Error('Canceled baseline draft was retained');
      const fileInput = await page.$('input[type="file"][accept=".pdf,.docx"]');
      if (!fileInput) throw new Error('Baseline file input not found');
      await fileInput.uploadFile(fileURLToPath(new URL('../fixtures/synthetic-sides.docx', import.meta.url)));
      await page.locator('button[title="Remove file"]').wait();
      await page.waitForFunction(() => [...document.querySelectorAll('button')].some(e => e.textContent.trim() === 'Save Baseline' && !e.disabled));
      await page.locator('button[title="Remove file"]').click();
      await page.waitForFunction(() => [...document.querySelectorAll('button')].some(e => e.textContent.trim() === 'Save Baseline' && e.disabled));
      await page.locator('button ::-p-text(Cancel)').click();
      page.off('request', countBaseline);
      if (submissions) throw new Error('Unexpected baseline request during cancellation check');
      console.log(JSON.stringify({journey:'baseline-form', emptyDisabled:true, textEnabled:true, cancelCleared:true, fileEnabled:true, removeDisabled:true, submissions}));
    }
    if (process.env.AC_CHECK_HEADER === '1' && path === '/dashboard') {
      if (process.env.AC_MOBILE === '1') throw new Error('Header check requires the desktop viewport');
      await page.locator('[aria-label="Support"]').click();
      await page.locator('h2 ::-p-text(Need Help?)').wait();
      if (!await page.$eval('h2::-p-text(Need Help?)', e => !!e.parentElement.querySelector('a[href="mailto:support@theactorscopilot.com"]'))) throw new Error('Support email link is missing from the modal');
      await page.$eval('h2::-p-text(Need Help?)', e => e.parentElement.querySelector('button').click());
      await page.waitForFunction(() => ![...document.querySelectorAll('h2')].some(e => e.textContent.includes('Need Help?')));
      await page.locator('[aria-label="Select theme"]').click();
      await page.locator('button ::-p-text(Dark)').click();
      await page.waitForFunction(() => document.documentElement.classList.contains('dark'));
      await page.reload({waitUntil:'domcontentloaded'});
      await page.waitForSelector('[aria-label="Select theme"]', {visible:true, timeout:30000});
      await page.waitForFunction(() => document.documentElement.classList.contains('dark'));
      await page.locator('[aria-label="Select theme"]').click();
      await page.locator('button ::-p-text(Light)').click();
      await page.waitForFunction(() => document.documentElement.classList.contains('light'));
      await page.locator('header a[aria-label="Settings"]').click();
      await page.waitForFunction(() => location.pathname === '/settings', {timeout:30000});
      await page.waitForSelector('nav a[href="/settings"][aria-current="page"]', {timeout:30000});
      console.log(JSON.stringify({journey:'desktop-header', supportOpenClose:true, darkAfterReload:true, lightSelected:true, settingsNavigation:true, settingsActive:true}));
    }
    if (process.env.AC_CHECK_VAULT === '1' && path === '/dna-vault') {
      const state = await page.waitForFunction(() => {
        const text = document.body.innerText;
        if (text.includes('Error loading DNA Vault')) return 'error';
        if (text.includes('No DNA Extracted Yet')) return 'empty';
        if (text.includes('Overview & Core Traits') && text.includes('Profiler Insights') && text.includes('Verbatim Memory Bank')) return 'populated';
        return false;
      }, {timeout:30000});
      const vaultState = await state.jsonValue();
      if (vaultState === 'error') throw new Error('DNA Vault reported a loading error');
      if (vaultState === 'empty') {
        const extractionLink = await page.$('a[href="/chat"]');
        if (!extractionLink) throw new Error('Empty vault did not link to DNA chat');
      } else {
        await page.locator('button ::-p-text(Profiler Insights)').click();
        await page.waitForSelector('input[placeholder="Filter deductions..."]', {visible:true});
        const noInsights = await page.evaluate(() => document.body.innerText.includes('No Profiler Deductions Yet'));
        await page.type('input[placeholder="Filter deductions..."]', 'zz-nonmatching-test-47391');
        await page.waitForSelector('[aria-label="Clear search"]', {visible:true});
        if (!noInsights) await page.waitForFunction(() => document.body.innerText.includes('No deductions match your search filter'));
        await page.locator('[aria-label="Clear search"]').click();
        await page.waitForFunction(() => document.querySelector('input[placeholder="Filter deductions..."]')?.value === '');
        await page.locator('button ::-p-text(Verbatim Memory Bank)').click();
        await page.waitForSelector('input[placeholder="Search actor quotes..."]', {visible:true});
        const noQuotes = await page.evaluate(() => document.body.innerText.includes('No Recorded Quotes Yet'));
        await page.type('input[placeholder="Search actor quotes..."]', 'zz-nonmatching-test-47391');
        await page.waitForSelector('[aria-label="Clear search"]', {visible:true});
        if (!noQuotes) await page.waitForFunction(() => document.body.innerText.includes('No memory quotes match your search filter'));
        await page.locator('[aria-label="Clear search"]').click();
        await page.waitForFunction(() => document.querySelector('input[placeholder="Search actor quotes..."]')?.value === '');
        await page.locator('button ::-p-text(Overview & Core Traits)').click();
        console.log(JSON.stringify({journey:'dna-vault-filters', noInsights, noQuotes, searchCleared:true}));
      }
      console.log(JSON.stringify({journey:'dna-vault', state:vaultState, tabsVisited:vaultState === 'populated'}));
    }
    if (process.env.AC_CHECK_TRACKER === '1' && path === '/auditions') {
      const search = 'input[placeholder="Search auditions by project or role..."]';
      await page.waitForFunction(() => document.querySelector('main h3') || document.body.innerText.includes('No auditions found'), {timeout:30000});
      const fixture = process.env.AC_TEST_PROJECT || await page.evaluate(() => [...document.querySelectorAll('main h3')].map(e => e.textContent.trim()).find(t => /^Verification Fixture \d+$/i.test(t)));
      if (!fixture) throw new Error('AC_TEST_PROJECT is required for the tracker check');
      await page.locator(search).fill(fixture);
      await page.waitForFunction(p => [...document.querySelectorAll('main h3')].some(e => e.textContent.trim().toLowerCase() === p.toLowerCase()), {timeout:30000}, fixture);
      const findCard = () => page.evaluateHandle(p => [...document.querySelectorAll('main h3')].find(e => e.textContent.trim().toLowerCase() === p.toLowerCase())?.closest('div.relative'), fixture);
      let card = (await findCard()).asElement();
      if (!card) throw new Error('Fixture card not found');
      const status = await card.evaluate(e => ['Draft', 'Processing', 'Completed'].find(s => [...e.querySelectorAll('span')].some(el => el.textContent.trim() === s)));
      if (!status) throw new Error('Fixture status not found');
      const role = await card.$eval('h3 + p', e => e.textContent.trim());
      if (!role) throw new Error('Fixture role not found');
      await page.locator(search).fill('zz-nonmatching-test-47391');
      await page.locator('h3 ::-p-text(No auditions found)').wait();
      await page.locator(search).fill(role.toLowerCase());
      await page.waitForFunction(p => [...document.querySelectorAll('main h3')].some(e => e.textContent.trim().toLowerCase() === p.toLowerCase()), {timeout:10000}, fixture);
      await page.locator(search).fill(fixture);
      const otherStatus = ['Draft', 'Processing', 'Completed'].find(s => s !== status);
      await page.locator(`main button ::-p-text(${otherStatus})`).click();
      await page.locator('h3 ::-p-text(No auditions found)').wait();
      await page.locator(`main button ::-p-text(${status})`).click();
      await page.waitForFunction(p => [...document.querySelectorAll('main h3')].some(e => e.textContent.trim().toLowerCase() === p.toLowerCase()), {timeout:10000}, fixture);
      await page.locator('main button ::-p-text(All)').click();
      card = (await findCard()).asElement();
      await card.$eval('button[title="Edit Details"]', e => e.click());
      await page.locator('h2 ::-p-text(Edit Audition Details)').wait();
      const projectInput = await page.$('h2 + div input');
      if (!projectInput) throw new Error('Edit project input not found');
      await projectInput.click({clickCount:3});
      await projectInput.type('Unsaved synthetic change');
      await page.locator('button ::-p-text(Cancel)').click();
      await card.$eval('button[title="Edit Details"]', e => e.click());
      await page.waitForFunction(p => document.querySelector('h2 + div input')?.value === p, {timeout:10000}, fixture);
      await page.locator('button ::-p-text(Cancel)').click();
      await card.$eval('button[title="Delete"]', e => e.click());
      await page.locator('[role="alertdialog"] ::-p-text(Delete Audition)').wait();
      await page.locator('[role="alertdialog"] button ::-p-text(Cancel)').click();
      await page.waitForFunction(p => [...document.querySelectorAll('main h3')].some(e => e.textContent.trim().toLowerCase() === p.toLowerCase()), {timeout:10000}, fixture);
      console.log(JSON.stringify({journey:'audition-tracker', projectSearch:true, roleSearch:true, nonmatchingSearch:true, statusFilter:true, editCancel:true, deleteCancel:true}));
    }
    if (process.env.AC_CHECK_PICKER === '1' && path === '/auditions/new/sides') {
      const project = process.env.AC_TEST_PROJECT;
      if (!project) throw new Error('AC_TEST_PROJECT is required for the picker check');
      await page.waitForSelector('section[aria-label="Saved auditions"]', {visible:true, timeout:30000});
      const cards = await page.$$('section[aria-label="Saved auditions"] button[aria-pressed]');
      let selected;
      for (const card of cards) {
        if ((await card.evaluate(e => e.innerText)).toLowerCase().includes(project.toLowerCase())) {
          selected = card;
          break;
        }
      }
      if (!selected) throw new Error('Named fixture was not found in Saved auditions');
      await selected.click();
      await page.waitForFunction(p => [...document.querySelectorAll('section[aria-label="Saved auditions"] button[aria-pressed="true"]')].some(e => e.innerText.toLowerCase().includes(p.toLowerCase())), {timeout:30000}, project);
      await page.locator('button ::-p-text(Save Output)').setTimeout(30000).wait();
      await page.locator('button ::-p-text(Start a new scene instead)').click();
      await page.waitForFunction(() => document.querySelector('#project')?.value === '', {timeout:30000});
      console.log(JSON.stringify({journey:'saved-scene-picker', selectedFixture:true, savedResultVisible:true, clearRestoredBlankScene:true}));
    }
    if (process.env.AC_MOBILE === '1' && process.env.AC_CHECK_NAV === '1' && path === '/dashboard') {
      await page.locator('[aria-label="Open menu"]').click();
      await page.locator('nav a[href="/auditions"]').click();
      await page.waitForFunction(() => location.pathname === '/auditions', {timeout:30000});
      await page.waitForSelector('input[placeholder="Search auditions by project or role..."]', {visible:true, timeout:30000});
      await page.waitForFunction(() => document.querySelector('aside')?.getBoundingClientRect().right <= 0, {timeout:5000});
      console.log(JSON.stringify({journey:'mobile-navigation', destination:'/auditions', menuClosed:true}));
    }
    if (process.env.AC_CHECK_SAVED === '1' && path === '/auditions') {
      const project = process.env.AC_TEST_PROJECT;
      if (!project) throw new Error('AC_TEST_PROJECT is required for the saved-audition check');
      await page.locator('input[placeholder="Search auditions by project or role..."]').fill(project);
      await page.waitForFunction(p => document.body.innerText.toLowerCase().includes(p.toLowerCase()), {timeout:30000}, project);
      const candidates = await page.$$('h3');
      let cardTitle;
      for (const candidate of candidates) {
        if ((await candidate.evaluate(e => e.textContent || '')).toLowerCase().includes(project.toLowerCase())) {
          cardTitle = candidate;
          break;
        }
      }
      if (!cardTitle) throw new Error('Saved audition title was not found');
      await cardTitle.click();
      await page.waitForFunction(() => /^\/auditions\/[^/]+$/.test(location.pathname), {timeout:30000});
      await page.waitForSelector('aside', {visible:true});
      await page.waitForFunction(p => document.body.innerText.toLowerCase().includes(p.toLowerCase()), {timeout:30000}, project);
      const detail = await page.evaluate(() => ({
        path:location.pathname.replace(/\/[^/]+$/, '/[id]'),
        headings:[...document.querySelectorAll('h1,h2,h3')].map(e=>e.innerText.trim()).filter(Boolean),
        buttons:[...document.querySelectorAll('button')].filter(e=>e.getClientRects().length).map(e=>(e.getAttribute('aria-label') || e.innerText).trim()).filter(Boolean),
      }));
      console.log(JSON.stringify({journey:'saved-audition-detail', ...detail}));
      if (process.env.AC_CHECK_LINKED_READER === '1') {
        const detailPath = new URL(page.url()).pathname;
        await page.locator('button ::-p-text(Rehearse Scene)').click();
        await page.waitForFunction(() => /^\/reader-copilot\/[^/]+$/.test(location.pathname), {timeout:30000});
        const state = await page.waitForFunction(() => {
          if (document.querySelector('[aria-label="Partner Voices"]')) return 'ready';
          if (document.body.innerText.includes('Rehearsal Unavailable')) return 'unavailable';
          return false;
        }, {timeout:90000});
        if (await state.jsonValue() === 'unavailable') {
          const missingSides = await page.evaluate(() => document.body.innerText.includes('No script sides text found in this audition.'));
          console.log(JSON.stringify({journey:'linked-reader', unavailable:true, missingSides}));
          throw new Error('Linked reader is unavailable for the named fixture');
        }
        const actorHeading = await page.$eval('h1', e => e.innerText);
        await page.locator('[aria-label="Mute AI audio"]').click();
        await page.locator('[aria-label="Unmute AI audio"]').wait();
        await page.locator('button ::-p-text(Change Character)').click();
        await page.locator('h2 ::-p-text(Choose Your Character)').wait();
        await page.locator('button ::-p-text(Return to auditions)').click();
        await page.waitForFunction(p => location.pathname === p, {timeout:30000}, detailPath);
        console.log(JSON.stringify({journey:'linked-reader', actorHeading, muteToggle:true, changeCharacter:true, returnedToSameDetail:true}));
      }
      if (process.env.AC_CHECK_ENRICH === '1') {
        const detailPath = new URL(page.url()).pathname;
        await page.locator('button ::-p-text(Attach Sides)').click();
        await page.waitForFunction(() => location.pathname === '/auditions/new/sides' && location.search.includes('enrichAuditionId='), {timeout:30000});
        await page.waitForFunction(p => document.querySelector('#project')?.value === p, {timeout:30000}, project);
        await page.locator('button ::-p-text(Next)').click();
        await page.locator('textarea[placeholder="Paste your details here..."]').fill('ALEX\nWhere is the key?\n\nSAM\nI left it on the table.\n\nALEX\nThank you.');
        await page.locator('button ::-p-text(Next)').click();
        const [analysisResponse] = await Promise.all([
          page.waitForResponse(r => r.url().includes('/api/auditions/analyzeSides') && r.request().method() === 'POST', {timeout:180000}),
          page.locator('button ::-p-text(Generate Breakdown)').click(),
        ]);
        if (!analysisResponse.ok()) throw new Error(`Sides analysis HTTP ${analysisResponse.status()}`);
        await page.locator('button ::-p-text(Save Output)').setTimeout(180000).wait();
        await page.locator('button ::-p-text(Save Output)').click();
        await page.waitForFunction(() => location.pathname === '/auditions', {timeout:30000});
        await page.reload({waitUntil:'domcontentloaded'});
        await page.waitForFunction(p => document.body.innerText.toLowerCase().includes(p.toLowerCase()), {timeout:30000}, project);
        await page.goto(new URL(detailPath, url).href, {waitUntil:'domcontentloaded'});
        await page.waitForFunction(() => {
          const headings = [...document.querySelectorAll('h2')].map(e => e.innerText.toLowerCase());
          return headings.includes('brief analysis') && headings.includes('sides analysis');
        }, {timeout:30000});
        console.log(JSON.stringify({journey:'brief-to-sides-enrichment', returnedToTracker:true, sameDetailHasBothAnalyses:true}));
      }
    }
    if (process.env.AC_CHECK_READER === '1' && path === '/reader-copilot') {
      await page.locator('textarea').fill('ALEX\nWhere is the key?\n\nSAM\nI left it on the table.\n\nALEX\nThank you.');
      await page.locator('button ::-p-text(Start Interactive Rehearsal)').click();
      await page.locator('h2 ::-p-text(Choose Your Character)').setTimeout(90000).wait();
      const characters = await page.$$eval('h3', headings => headings.map(e => e.innerText));
      await page.locator('button ::-p-text(ALEX)').click();
      await page.locator('[aria-label="Partner Voices"]').wait();
      console.log(JSON.stringify({journey:path, characters, rehearsalControlsVisible:true}));
    }
    if (process.env.AC_CHECK_DNA === '1' && path === '/chat') {
      const message = `Fictional acting exercise ${Date.now()}: I enjoy playing a character who solves problems through patience.`;
      await page.waitForSelector('[aria-label="Change the subject"]:not([disabled])', {timeout:30000});
      await page.locator('textarea').click();
      await page.type('textarea', message);
      try {
        await page.waitForSelector('[aria-label="Send message"]', {visible:true, timeout:10000});
      } catch (error) {
        const state = await page.evaluate(() => ({
          textLength: document.querySelector('textarea')?.value.length,
          inputDisabled: document.querySelector('textarea')?.disabled,
          actionLabels: [...document.querySelectorAll('button[aria-label]')].map(e => e.getAttribute('aria-label')),
        }));
        console.error(JSON.stringify({journey:'dna-chat', stage:'send-control', ...state}));
        throw error;
      }
      const [response] = await Promise.all([
        page.waitForResponse(r => r.url().includes('/api/dna/chat') && r.request().method() === 'POST', {timeout:120000}),
        page.locator('[aria-label="Send message"]').click(),
      ]);
      if (!response.ok()) throw new Error(`DNA chat HTTP ${response.status()}`);
      await page.waitForSelector('[aria-label="Change the subject"]:not([disabled])', {timeout:120000});
      const hasReply = m => {
        const bubbles = [...document.querySelectorAll('div.group.w-full')];
        const index = bubbles.findIndex(e => e.innerText.includes(m));
        return index >= 0 && bubbles.slice(index + 1).some(e => e.classList.contains('justify-start'));
      };
      await page.waitForFunction(hasReply, {timeout:120000}, message);
      console.log(JSON.stringify({journey:'dna-chat', responseVisibleBeforeReload:true}));
      await page.reload({waitUntil:'domcontentloaded'});
      await page.waitForFunction(hasReply, {timeout:60000}, message);
      console.log(JSON.stringify({journey:'dna-chat', responseVisible:true, exchangeVisibleAfterReload:true}));
    }
    if (process.env.AC_CHECK_WIZARD === '1' && ['/auditions/new/brief', '/auditions/new/sides'].includes(path)) {
      const project = `Verification Fixture ${Date.now()}`;
      await page.locator('#project').fill(project);
      await page.locator('#role').fill('Alex');
      await page.locator('button ::-p-text(Next)').click();
      if (path.endsWith('/sides') && process.env.AC_SIDES_FILE) {
        const fileInput = await page.$('input[type="file"]');
        if (!fileInput) throw new Error('Sides file input was not found');
        await fileInput.uploadFile(process.env.AC_SIDES_FILE);
      } else {
        await page.locator('textarea[placeholder="Paste your details here..."]').fill('Fictional scene: Alex asks Sam to return a borrowed key.');
      }
      await page.locator('button ::-p-text(Next)').click();
      const review = await page.evaluate(() => ({
        headings: [...document.querySelectorAll('h1,h2,h3')].map(e => e.innerText.trim()).filter(Boolean),
        generateEnabled: [...document.querySelectorAll('button')].find(e => e.innerText.includes('Generate Breakdown'))?.disabled === false,
        fixtureVisible: document.body.innerText.toLowerCase().includes('verification fixture'),
      }));
      if (!review.generateEnabled || !review.fixtureVisible) throw new Error(`Wizard review failed: ${path}`);
      if (process.env.AC_GENERATE === '1') {
        const endpoint = path.endsWith('/brief') ? '/api/auditions/analyzeBrief' : '/api/auditions/analyzeSides';
        const [analysisResponse] = await Promise.all([
          page.waitForResponse(r => r.url().includes(endpoint) && r.request().method() === 'POST', {timeout:180000}),
          page.locator('button ::-p-text(Generate Breakdown)').click(),
        ]);
        if (!analysisResponse.ok()) throw new Error(`Analysis HTTP ${analysisResponse.status()}`);
        await page.locator('button ::-p-text(Save Output)').setTimeout(180000).wait();
        console.log(JSON.stringify({journey:path, generated:true}));
        await page.locator('button ::-p-text(Save Output)').click();
        await page.waitForFunction(() => location.pathname === '/auditions', {timeout:30000});
        await page.waitForFunction(p => document.body.innerText.toLowerCase().includes(p.toLowerCase()), {timeout:30000}, project);
        await page.reload({waitUntil:'domcontentloaded'});
        await page.waitForFunction(p => document.body.innerText.toLowerCase().includes(p.toLowerCase()), {timeout:30000}, project);
        console.log(JSON.stringify({journey:path, savedAndReloaded:true, fixture:project}));
        continue;
      }
      await page.locator('button ::-p-text(Back)').click();
      const restored = process.env.AC_SIDES_FILE && path.endsWith('/sides')
        ? await page.evaluate(() => !!document.querySelector('button[title="Remove file"]'))
        : await page.$eval('textarea', el => el.value.includes('Fictional scene'));
      console.log(JSON.stringify({journey: path, review, inputRetainedAfterBack: restored}));
      if (!restored) throw new Error(`Wizard back-navigation failed: ${path}`);
    }
  }
} finally {
  await browser.close();
}
