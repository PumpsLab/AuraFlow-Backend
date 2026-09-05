#!/usr/bin/env node
/**
 * AuraFlow API Test Script
 *
 * Tests the full auth flow and key API endpoints against a running backend.
 * Requires: tweetnacl, @stellar/stellar-sdk (already in auraflow-backend)
 *
 * Usage:
 *   node test-api.js                    # generates a fresh keypair
 *   node test-api.js --save             # generates and saves keypair to keypair.json
 *   node test-api.js --load keypair.json # loads a saved keypair
 */

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const nacl = require('tweetnacl');
const { Keypair } = require('@stellar/stellar-sdk');

const BASE = 'http://localhost:4000';
const AUTH_VERSION = '1';
const AUTH_PREFIX = 'AuraFlow Request Authorization';

// ── Helpers ──────────────────────────────────────────────────────────

function bytesToHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(input) {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return bytesToHex(new Uint8Array(digest));
}

function normalizePath(p) {
  const url = new URL(p, 'http://localhost');
  let pathname = url.pathname;
  if (pathname.length > 1 && pathname.endsWith('/')) pathname = pathname.slice(0, -1);
  return `${pathname}${url.search}`;
}

function stellarAddressToPubKey(address) {
  // Decode StrKey: version(1) + ed25519(32) + checksum(4), all base32
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const raw = address.slice(1); // drop 'G' version byte
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (const c of raw) {
    const idx = alphabet.indexOf(c);
    if (idx === -1) throw new Error(`Invalid base32 char: ${c}`);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >>> bits) & 0xff);
    }
  }
  // bytes now has version + pubkey + checksum; return first 32 (pubkey)
  return new Uint8Array(bytes.slice(1, 33));
}

async function buildAuthMessage({ wallet, method, path, timestamp, body }) {
  const bodyHash = await sha256Hex(body ?? '');
  return [
    AUTH_PREFIX,
    `version:${AUTH_VERSION}`,
    `wallet:${wallet}`,
    `method:${method.toUpperCase()}`,
    `path:${normalizePath(path)}`,
    `timestamp:${timestamp}`,
    `bodySha256:${bodyHash}`,
  ].join('\n');
}

function signMessage(message, secretKey) {
  const msgBytes = new TextEncoder().encode(message);
  const sig = nacl.sign.detached(msgBytes, secretKey);
  return Buffer.from(sig).toString('base64');
}

function stellarSeedToNaclSecretKey(seed) {
  // Stellar seed (32 bytes) → tweetnacl 64-byte secret key (seed + pubkey)
  const kp = nacl.sign.keyPair.fromSeed(seed);
  return kp.secretKey;
}

function generateKeypair() {
  const kp = Keypair.random();
  return {
    publicKey: kp.publicKey(),
    secretKey: kp.secret(),
    naclSecretKey: stellarSeedToNaclSecretKey(kp.rawSecretKey()),
  };
}

function loadKeypair(filepath) {
  const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
  const kp = Keypair.fromSecret(data.secretKey);
  return {
    publicKey: kp.publicKey(),
    secretKey: kp.secret(),
    naclSecretKey: stellarSeedToNaclSecretKey(kp.rawSecretKey()),
  };
}

// ── HTTP helper ──────────────────────────────────────────────────────

function request(method, urlPath, { body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE);
    const bodyStr = body ? JSON.stringify(body) : null;
    const opts = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };
    if (bodyStr) opts.headers['Content-Length'] = Buffer.byteLength(bodyStr);

    const req = http.request(opts, res => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        let json;
        try { json = JSON.parse(data); } catch { json = data; }
        resolve({ status: res.statusCode, body: json });
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ── Auth helpers ─────────────────────────────────────────────────────

async function signRequest(keypair, method, path, body) {
  const timestamp = new Date().toISOString();
  const bodyStr = body ? JSON.stringify(body) : '';
  const message = await buildAuthMessage({
    wallet: keypair.publicKey,
    method,
    path,
    timestamp,
    body: bodyStr,
  });
  const signature = signMessage(message, keypair.naclSecretKey);
  return {
    'x-auraflow-wallet': keypair.publicKey,
    'x-auraflow-timestamp': timestamp,
    'x-auraflow-signature': signature,
  };
}

async function authPost(keypair, path, body) {
  const authHeaders = await signRequest(keypair, 'POST', path, body);
  return request('POST', path, { body, headers: authHeaders });
}

async function authGet(keypair, path) {
  const authHeaders = await signRequest(keypair, 'GET', path);
  return request('GET', path, { headers: authHeaders });
}

async function sessionGet(keypair, path, sessionToken) {
  return request('GET', path, {
    headers: { 'x-auraflow-session': sessionToken },
  });
}

async function sessionPost(keypair, path, body, sessionToken) {
  return request('POST', path, {
    body,
    headers: { 'x-auraflow-session': sessionToken },
  });
}

// ── Test steps ───────────────────────────────────────────────────────

async function log(label, fn) {
  process.stdout.write(`  ${label} ... `);
  try {
    const result = await fn();
    console.log(`✓ ${JSON.stringify(result).slice(0, 120)}`);
    return result;
  } catch (err) {
    console.log(`✗ ${err.message || err}`);
    throw err;
  }
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  let keypair;

  if (args.includes('--load')) {
    const file = args[args.indexOf('--load') + 1];
    console.log(`Loading keypair from ${file}...`);
    keypair = loadKeypair(file);
  } else {
    console.log('Generating fresh Stellar keypair...');
    keypair = generateKeypair();
  }

  console.log(`Wallet: ${keypair.publicKey}\n`);

  if (args.includes('--save')) {
    const savePath = path.join(__dirname, 'keypair.json');
    fs.writeFileSync(savePath, JSON.stringify({
      publicKey: keypair.publicKey,
      secretKey: keypair.secretKey,
    }, null, 2));
    console.log(`Keypair saved to ${savePath}\n`);
  }

  // ── Step 1: Get session token ──────────────────────────────────
  console.log('1. Authentication');
  const sessionRes = await log('POST /auth/session', () =>
    authPost(keypair, '/api/v1/auth/session', { wallet: keypair.publicKey })
  );
  const sessionToken = sessionRes.body?.sessionToken;
  if (!sessionToken) {
    console.error('Failed to get session token. Aborting.');
    process.exit(1);
  }
  console.log(`  Session: ${sessionToken.slice(0, 30)}...\n`);

  // ── Step 2: Create company ─────────────────────────────────────
  console.log('2. Company');
  const createCompanyRes = await log('POST /companies (direct signed)', () =>
    authPost(keypair, '/api/v1/companies', {
      name: 'Test Corp',
      employerWallet: keypair.publicKey,
    })
  );

  const companyId = createCompanyRes.body?.company?.id;
  console.log(`  Company ID: ${companyId || 'N/A'}\n`);

  // ── Step 3: Get company profile ────────────────────────────────
  console.log('3. Company Profile');
  await log('GET /companies/me', () =>
    sessionGet(keypair, `/api/v1/companies/me?employerWallet=${keypair.publicKey}`, sessionToken)
  );
  console.log();

  // ── Step 4: Treasury ───────────────────────────────────────────
  if (companyId) {
    console.log('4. Treasury');
    await log('GET /companies/:id/balance', () =>
      sessionGet(keypair, `/api/v1/companies/${companyId}/balance?wallet=${keypair.publicKey}`, sessionToken)
    );
    await log('GET /companies/:id/treasury', () =>
      sessionGet(keypair, `/api/v1/companies/${companyId}/treasury?wallet=${keypair.publicKey}`, sessionToken)
    );
    console.log();
  }

  // ── Step 5: Employees ──────────────────────────────────────────
  console.log('5. Employees');
  await log('GET /employees', () =>
    sessionGet(keypair, `/api/v1/employees?employerWallet=${keypair.publicKey}`, sessionToken)
  );
  console.log();

  // ── Step 6: Streams ────────────────────────────────────────────
  console.log('6. Streams');
  await log('GET /streams', () =>
    sessionGet(keypair, `/api/v1/streams?employerWallet=${keypair.publicKey}`, sessionToken)
  );
  console.log();

  // ── Step 7: Payroll ────────────────────────────────────────────
  console.log('7. Payroll');
  await log('GET /payroll/state', () =>
    sessionGet(keypair, `/api/v1/payroll/state?employerWallet=${keypair.publicKey}`, sessionToken)
  );
  console.log();

  // ── Step 8: Claims ─────────────────────────────────────────────
  console.log('8. Claims');
  await log('GET /claim/balance', () =>
    request('GET', `/api/v1/claim/balance?wallet=${keypair.publicKey}`)
  );
  console.log();

  // ── Step 9: Audit ──────────────────────────────────────────────
  console.log('9. Audit');
  await log('GET /auditor-tokens', () =>
    sessionGet(keypair, `/api/v1/auditor-tokens?employerWallet=${keypair.publicKey}`, sessionToken)
  );
  console.log();

  // ── Step 10: History ───────────────────────────────────────────
  console.log('10. History');
  await log('GET /history', () =>
    sessionGet(keypair, `/api/v1/history?employerWallet=${keypair.publicKey}`, sessionToken)
  );
  console.log();

  console.log('All tests passed!');
}

main().catch(err => {
  console.error('\nFatal:', err);
  process.exit(1);
});
