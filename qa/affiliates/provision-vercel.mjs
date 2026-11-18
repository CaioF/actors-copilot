#!/usr/bin/env node
// Adds only new production variables; values travel over stdin, never argv.
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';

const linked = process.env.AC_VERCEL_LINKED_DIR;
if (!linked || process.env.AC_PROVISION_QA !== '1') throw new Error('Set AC_VERCEL_LINKED_DIR and AC_PROVISION_QA=1');
const project = JSON.parse(await readFile(`${linked}/.vercel/project.json`,'utf8'));
if (project.projectName !== 'actors-copilot') throw new Error('The linked Vercel project is not actors-copilot');
const lines = (await readFile('.env.qa.local','utf8')).split(/\r?\n/);
const entries = new Map(lines.filter(line => line.includes('=')).map(line => {
  const index=line.indexOf('='); return [line.slice(0,index),line.slice(index+1)];
}));
const names=['QA_SIMULATION_SECRET','QA_SIMULATION_ALLOWED_UIDS','QA_SIMULATION_ALLOWED_EMAILS','QA_SIMULATION_ALLOWED_AFFILIATES','QA_SIMULATION_ENABLED'];
if (!/^[a-f0-9]{64}$/i.test(entries.get('QA_SIMULATION_SECRET') || '') || names.some(name => !entries.get(name)) || entries.get('QA_SIMULATION_ENABLED') !== 'true') throw new Error('Invalid local QA configuration');
// Production stays disabled until effective Firestore rules have been verified.
entries.set('QA_SIMULATION_ENABLED','false');
for (const name of names) {
  const result=spawnSync('vercel',['env','add',name,'--environment','production','--sensitive','--yes'], {
    cwd:linked, input:entries.get(name), encoding:'utf8', shell:process.platform === 'win32', windowsHide:true,
  });
  if (result.status !== 0) {
    console.error(`Could not add ${name}; inspect the Vercel project before retrying. Existing values are never overwritten.`);
    process.exit(1);
  }
  console.log(`Configured ${name} in the linked production project.`);
}
