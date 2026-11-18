#!/usr/bin/env node
// One-time local setup. The generated .env.qa.local must never be committed.
import {randomBytes} from 'node:crypto';
import {writeFile} from 'node:fs/promises';

const {AC_TEST_EMAIL:email, AC_TEST_PASSWORD:password} = process.env;
const apiKey = process.env.AC_FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
if (!email || !password || !apiKey) throw new Error('Provide a specifically authorized test account and Firebase API key');
const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`, {
  method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true}),
});
if (!response.ok) throw new Error('Unable to verify the designated test account');
const {localId} = await response.json();
if (typeof localId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(localId) || !/^[a-zA-Z0-9._+@-]+$/.test(email)) throw new Error('Unexpected test identity format');
const secret=randomBytes(32).toString('hex');
await writeFile('.env.qa.local',[
  'QA_SIMULATION_ENABLED=true',
  `QA_SIMULATION_SECRET=${secret}`,
  `QA_SIMULATION_ALLOWED_UIDS=${localId}`,
  `QA_SIMULATION_ALLOWED_EMAILS=${email.toLowerCase()}`,
  'QA_SIMULATION_ALLOWED_AFFILIATES=lucas',
  `AC_QA_UID=${localId}`,
  '',
].join('\n'),{flag:'wx',mode:0o600});
console.log('Created ignored local QA configuration for one verified test identity.');
