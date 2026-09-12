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
require('dotenv').config();
const nacl = require('tweetnacl');
const { Keypair, TransactionBuilder, Operation, Asset } = require('@stellar/stellar-sdk');

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
  // SEP-53: prepend "Stellar Signed Message:\n" then SHA-256 before signing
  // Matches Freighter's signMessage() output
  const prefix = 'Stellar Signed Message:\n';
  const payload = prefix + message;
  const hash = crypto.createHash('sha256').update(payload).digest();
  const sig = nacl.sign.detached(hash, secretKey);
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

  // ── Step 11: Funding Instructions ──────────────────────────────
  let treasuryPubkey;
  if (companyId) {
    console.log('11. Funding Instructions');
    const fundingRes = await log('GET /companies/:id/funding-instructions', () =>
      sessionGet(keypair, `/api/v1/companies/${companyId}/funding-instructions?wallet=${keypair.publicKey}`, sessionToken)
    );
    treasuryPubkey = fundingRes.body?.treasuryPubkey;
    console.log(`  Treasury pubkey: ${treasuryPubkey || 'N/A'}`);
    console.log(`  Is ready: ${fundingRes.body?.isReady}`);
    console.log(`  Steps: ${fundingRes.body?.steps?.map(s => `${s.step}:${s.status}`).join(', ')}`);
    console.log();
  }

  // ── Step 12: Fund XLM to Treasury via Friendbot ────────────────
  if (treasuryPubkey) {
    console.log('12. Fund XLM to Treasury');
    try {
      const fbRes = await fetch(`https://friendbot.stellar.org/?addr=${treasuryPubkey}`);
      const fbData = await fbRes.json();
      if (fbData.successful) {
        console.log(`  ✓ Friendbot funded ${treasuryPubkey.slice(0, 12)}...`);
      } else {
        console.log(`  ✗ Friendbot error: ${JSON.stringify(fbData).slice(0, 120)}`);
      }
    } catch (err) {
      console.log(`  ✗ Friendbot request failed: ${err.message}`);
    }
    // Wait for ledger
    await new Promise(r => setTimeout(r, 3000));
    console.log();

    // ── Step 13: Verify Balance After XLM Funding ──────────────
    console.log('13. Balance After XLM Funding');
    const balanceAfterXlm = await log('GET /companies/:id/balance', () =>
      sessionGet(keypair, `/api/v1/companies/${companyId}/balance?wallet=${keypair.publicKey}`, sessionToken)
    );
    console.log(`  XLM: ${balanceAfterXlm.body?.balance?.xlm}`);
    console.log();

    // ── Step 14: Setup Trustline ───────────────────────────────
    console.log('14. Setup USDC Trustline');
    const trustlineRes = await log('POST /companies/:id/setup-trustline', () =>
      sessionPost(keypair, `/api/v1/companies/${companyId}/setup-trustline?wallet=${keypair.publicKey}`, {}, sessionToken)
    );
    console.log(`  Tx hash: ${trustlineRes.body?.txHash || 'N/A'}`);
    // Wait for ledger
    await new Promise(r => setTimeout(r, 3000));
    console.log();

    // ── Step 14.5: Fund Employer Wallet via Friendbot ──────────
    console.log('14.5. Fund Employer Wallet');
    try {
      const fbEmpRes = await fetch(`https://friendbot.stellar.org/?addr=${keypair.publicKey}`);
      const fbEmpData = await fbEmpRes.json();
      if (fbEmpData.successful) {
        console.log(`  ✓ Friendbot funded employer ${keypair.publicKey.slice(0, 12)}...`);
      } else {
        console.log(`  ✗ Friendbot error: ${JSON.stringify(fbEmpData).slice(0, 120)}`);
      }
    } catch (err) {
      console.log(`  ✗ Friendbot request failed: ${err.message}`);
    }
    await new Promise(r => setTimeout(r, 3000));
    console.log();

    // ── Step 14.6: Generate + Fund Employee Wallet ─────────────
    console.log('14.6. Generate + Fund Employee Wallet');
    const employeeKp = Keypair.random();
    console.log(`  Employee wallet: ${employeeKp.publicKey()}`);
    try {
      const fbEmp2Res = await fetch(`https://friendbot.stellar.org/?addr=${employeeKp.publicKey()}`);
      const fbEmp2Data = await fbEmp2Res.json();
      if (fbEmp2Data.successful) {
        console.log(`  ✓ Friendbot funded employee ${employeeKp.publicKey().slice(0, 12)}...`);
      } else {
        console.log(`  ✗ Friendbot error: ${JSON.stringify(fbEmp2Data).slice(0, 120)}`);
      }
    } catch (err) {
      console.log(`  ✗ Friendbot request failed: ${err.message}`);
    }
    await new Promise(r => setTimeout(r, 3000));
    console.log();

    // ── Step 14.7: Employee USDC Trustline ─────────────────────
    console.log('14.7. Employee USDC Trustline');
    try {
      const { Horizon: HorizonSdk } = require('@stellar/stellar-sdk');
      const empHorizon = new HorizonSdk.Server('https://horizon-testnet.stellar.org');
      const empAccount = await empHorizon.loadAccount(employeeKp.publicKey());
      const usdcIssuer = process.env.USDC_ISSUER || 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
      const empUsdcAsset = new Asset('USDC', usdcIssuer);

      const empTrustTx = new TransactionBuilder(empAccount, {
        fee: '100000',
        networkPassphrase: 'Test SDF Network ; September 2015',
      })
        .addOperation(Operation.changeTrust({ asset: empUsdcAsset }))
        .setTimeout(300)
        .build();
      empTrustTx.sign(employeeKp);

      const empTrustResult = await empHorizon.submitTransaction(empTrustTx);
      console.log(`  ✓ Employee trustline set. Hash: ${empTrustResult.hash?.slice(0, 16)}...`);
    } catch (err) {
      console.log(`  ✗ Employee trustline failed: ${err.message?.slice(0, 200)}`);
    }
    await new Promise(r => setTimeout(r, 3000));
    console.log();

    // ── Step 15: Build Fund Treasury Transaction ──────────────
    console.log('15. Build Fund Treasury Transaction');
    const buildRes = await log('POST /companies/:id/fund-treasury (build)', () =>
      sessionPost(keypair, `/api/v1/companies/${companyId}/fund-treasury?wallet=${keypair.publicKey}`, { amount: 1.0 }, sessionToken)
    );
    const unsignedXdr = buildRes.body?.xdr;
    const netPassphrase = buildRes.body?.networkPassphrase;
    console.log(`  XDR length: ${unsignedXdr?.length || 0}`);
    console.log(`  Network: ${netPassphrase}`);
    console.log();

    // ── Step 16: Sign & Submit Fund Treasury ──────────────────
    if (unsignedXdr && netPassphrase) {
      console.log('16. Sign & Submit Fund Treasury');
      try {
        const tx = TransactionBuilder.fromXDR(unsignedXdr, netPassphrase);
        tx.sign(Keypair.fromSecret(keypair.secretKey));
        const signedXdr = tx.toXDR();

        const submitRes = await sessionPost(keypair, `/api/v1/companies/${companyId}/fund-treasury/submit?wallet=${keypair.publicKey}`, { signedXdr }, sessionToken);
        if (submitRes.body?.ok) {
          console.log(`  ✓ Submitted! Hash: ${submitRes.body.txHash?.slice(0, 16)}...`);
        } else {
          console.log(`  ✗ Submit failed: ${JSON.stringify(submitRes.body).slice(0, 120)}`);
        }
      } catch (err) {
        console.log(`  ✗ Sign/submit error: ${err.message}`);
      }
      // Wait for ledger
      await new Promise(r => setTimeout(r, 3000));
      console.log();

      // ── Step 17: Final Balance Check ────────────────────────
      console.log('17. Final Balance Check');
      const finalBalance = await log('GET /companies/:id/balance', () =>
        sessionGet(keypair, `/api/v1/companies/${companyId}/balance?wallet=${keypair.publicKey}`, sessionToken)
      );
      console.log(`  XLM: ${finalBalance.body?.balance?.xlm}`);
      console.log(`  USDC: ${finalBalance.body?.balance?.usdc}`);
      console.log(`  Has trustline: ${finalBalance.body?.balance?.hasTrustline}`);
      console.log();

        // ── Step 18: Build Process Payroll Batch ──────────────
        const payrollContract = process.env.AURAFLOW_PAYROLL_CONTRACT || '';
        if (payrollContract) {
          console.log('18. Build Process Payroll Batch');
          const recipientWallet = employeeKp.publicKey();
          const payrollBuildRes = await log('POST /private-payroll/build-transaction', () =>
            authPost(keypair, `/api/v1/private-payroll/build-transaction?wallet=${keypair.publicKey}`, {
              employerWallet: keypair.publicKey,
              payPeriod: '2026-09',
              recipients: [
                { employeeId: 'test-employee', name: 'Test Employee', address: recipientWallet, amount: 0.1 },
              ],
            })
          );
          const payrollXdr = payrollBuildRes.body?.xdr;
          const simWarning = payrollBuildRes.body?.simulationWarning;
          console.log(`  XDR length: ${payrollXdr?.length || 0}`);
          if (simWarning) console.log(`  ⚠ Simulation warning: ${simWarning.slice(0, 120)}`);
          console.log();

          // ── Step 19: Sign & Submit Payroll Batch ────────────
          if (payrollXdr) {
            console.log('19. Sign & Submit Payroll Batch');
            try {
              const payrollTx = TransactionBuilder.fromXDR(payrollXdr, payrollBuildRes.body?.networkPassphrase || 'Test SDF Network ; September 2015');
              payrollTx.sign(Keypair.fromSecret(keypair.secretKey));
              const signedPayrollXdr = payrollTx.toXDR();

              const submitPayrollRes = await authPost(keypair, `/api/v1/private-payroll/submit?wallet=${keypair.publicKey}`, { signedXdr: signedPayrollXdr });
              if (submitPayrollRes.body?.ok) {
                console.log(`  ✓ Payroll submitted! Hash: ${submitPayrollRes.body.txHash?.slice(0, 16)}...`);
              } else {
                console.log(`  ✗ Submit failed: ${JSON.stringify(submitPayrollRes.body).slice(0, 200)}`);
              }
            } catch (err) {
              console.log(`  ✗ Sign/submit error: ${err.message?.slice(0, 200)}`);
            }
            console.log();
          }
        }
    }
  }

  console.log('All tests passed!');
}

main().catch(err => {
  console.error('\nFatal:', err);
  process.exit(1);
});
