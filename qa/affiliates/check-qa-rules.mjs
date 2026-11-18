#!/usr/bin/env node
// Signed-in read-only probe of a random nonexistent QA document.
import {randomUUID} from 'node:crypto';
const {AC_TEST_EMAIL:email, AC_TEST_PASSWORD:password, NEXT_PUBLIC_FIREBASE_PROJECT_ID:project} = process.env;
const apiKey = process.env.AC_FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
if (!email || !password || !project || !apiKey) throw new Error('Missing test identity or Firebase project configuration');
const login = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`, {
  method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true}),
});
if (!login.ok) throw new Error('Test identity sign-in failed');
const {idToken,localId}=await login.json();
const tokenProject = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64url').toString('utf8')).aud;
const database=encodeURIComponent(process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID || '(default)');
const url=`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(project)}/databases/${database}/documents/qaAffiliateSimulations/qa-probe-${randomUUID()}`;
const response=await fetch(url,{headers:{authorization:`Bearer ${idToken}`}});
const info = await response.json().catch(() => ({}));
const own = await fetch(`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(project)}/databases/${database}/documents/users/${encodeURIComponent(localId)}`,{headers:{authorization:`Bearer ${idToken}`}});
const adminProjection = await fetch(`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(project)}/databases/${database}/documents/adminMembers/${encodeURIComponent(localId)}`,{headers:{authorization:`Bearer ${idToken}`}});
const docName = `projects/${project}/databases/${process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID || '(default)'}/documents/qaAffiliateSimulations/qa-probe-${randomUUID()}`;
const write = await fetch(`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(project)}/databases/${database}/documents:commit`,{
  method:'POST',headers:{authorization:`Bearer ${idToken}`,'content-type':'application/json'},
  body:JSON.stringify({writes:[{update:{name:docName,fields:{probe:{booleanValue:true}}},currentDocument:{exists:true}}]}),
});
const pass = tokenProject === project && own.status === 200 && adminProjection.status === 403 && response.status === 403 && write.status === 403;
console.log(JSON.stringify({pass,qaReadStatus:response.status,qaWriteStatus:write.status,errorStatus:info.error?.status || null,ownUserStatus:own.status,adminProjectionStatus:adminProjection.status,tokenProjectMatches:tokenProject === project,missingDatabase:/database.*does not exist/i.test(info.error?.message || '')}));
if (!pass) process.exitCode=1;
