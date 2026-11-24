#!/usr/bin/env node
/** Publica firestore.rules en el proyecto de Firebase de .env.local (sin abrir la consola). */
import { readFileSync } from 'node:fs';
import { cert, initializeApp } from 'firebase-admin/app';
import { getSecurityRules } from 'firebase-admin/security-rules';

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
}
const account = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_B64, 'base64').toString());
const app = initializeApp({ credential: cert(account), projectId: account.project_id });
const rules = getSecurityRules(app);
const source = readFileSync('firestore.rules', 'utf8');
await rules.releaseFirestoreRulesetFromSource(source);
const current = await rules.getFirestoreRuleset();
console.log(`Reglas publicadas en ${account.project_id}: ${current.name.split('/').pop()} (${current.createTime})`);
console.log('Incluye delivery:', current.source[0].content.includes('delivery_orders'));
process.exit(0);
