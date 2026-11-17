#!/usr/bin/env node
// Disposable Chrome session. Credentials are supplied only through environment variables.
import puppeteer from 'puppeteer-core';

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
  await page.waitForFunction(() => location.pathname !== '/login', {timeout: 30000});
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
      await page.locator('textarea[placeholder="Paste your details here..."]').fill('Fictional scene: Alex asks Sam to return a borrowed key.');
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
      const restored = await page.$eval('textarea', el => el.value.includes('Fictional scene'));
      console.log(JSON.stringify({journey: path, review, textRetainedAfterBack: restored}));
      if (!restored) throw new Error(`Wizard back-navigation failed: ${path}`);
    }
  }
} finally {
  await browser.close();
}
