# Migration Guide: AuraFlow Backend — Arbitrum/Viem → Stellar/SDK

## Overview

This guide migrates the AuraFlow NestJS backend from Ethereum/Viem (Arbitrum) to Stellar SDK with Soroban contract interactions.

**Current state:** NestJS API using Viem for Arbitrum Sepolia — wallet auth (ECDSA signatures), key generation (secp256k1), contract reads (readContract), and private payroll stubs.
**Target state:** NestJS API using `@stellar/stellar-sdk` — wallet auth (Ed25519 signatures), key generation (Ed25519), Soroban contract reads/writes, real confidential payroll.

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | ≥ 18 | `nvm install 18` |
| MongoDB | ≥ 7.0 | Running locally or Atlas |
| Stellar testnet account | — | Funded with XLM via Friendbot |

---

## Step 1: Update Dependencies

```bash
cd /Users/user/Downloads/Backend/auraflow-backend

# Remove Ethereum dependencies
npm uninstall viem

# Add Stellar dependencies
npm install @stellar/stellar-sdk

# Optional: for Ed25519 signature verification (if not using stellar-sdk's built-in)
npm install tweetnacl
```

**Updated package.json dependencies:**
```json
{
  "dependencies": {
    "@nestjs/common": "^10.4.0",
    "@nestjs/config": "^3.2.0",
    "@nestjs/core": "^10.4.0",
    "@nestjs/platform-express": "^10.4.0",
    "@stellar/stellar-sdk": "^14.2.0",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.1",
    "mongodb": "^7.1.1",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1",
    "tweetnacl": "^1.0.3",
    "zod": "^4.3.6"
  }
}
```

---

## Step 2: Update Environment Variables

Replace `.env.example`:
```bash
NODE_ENV=development
PORT=4000

MONGODB_URI=mongodb://localhost:27017
MONGODB_DB=auraflow

# Stellar Network
STELLAR_NETWORK_PASSPHRASE=Test SDF Future Network ; October 2022
STELLAR_RPC_URL=https://soroban-testnet.stellar.org

AURAFLOW_SESSION_SECRET=change_me_to_a_secure_random_string
COMPANY_KEY_ENCRYPTION_SECRET=change_me_to_a_32_byte_hex_key

# Deployed Soroban Contract Addresses
CONFIDENTIAL_TOKEN_CONTRACT=
AURAFLOW_PAYROLL_CONTRACT=
VERIFIER_CONTRACT=
AUDITOR_CONTRACT=

# Stellar USDC (SAC)
USDC_CONTRACT=CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA

CORS_ORIGIN=http://localhost:3000
```

---

## Step 3: Update Configuration

**File:** `src/config/configuration.ts`

Replace the `blockchain` section:
```typescript
export default () => ({
  port: parseInt(process.env.PORT || '4000', 10),
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
    db: process.env.MONGODB_DB || 'auraflow',
  },
  session: {
    secret: process.env.AURAFLOW_SESSION_SECRET || '',
    maxAgeMs: 12 * 60 * 60 * 1000,
  },
  encryption: {
    companyKeySecret: process.env.COMPANY_KEY_ENCRYPTION_SECRET || '',
  },
  blockchain: {
    stellarRpcUrl: process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org',
    stellarNetworkPassphrase: process.env.STELLAR_NETWORK_PASSPHRASE || 'Test SDF Future Network ; October 2022',
    confidentialTokenContract: process.env.CONFIDENTIAL_TOKEN_CONTRACT || '',
    payrollContract: process.env.AURAFLOW_PAYROLL_CONTRACT || '',
    verifierContract: process.env.VERIFIER_CONTRACT || '',
    auditorContract: process.env.AUDITOR_CONTRACT || '',
    usdcContract: process.env.USDC_CONTRACT || 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA',
  },
});
```

---

## Step 4: Replace Blockchain Service

**File:** `src/blockchain/blockchain.service.ts`

Replace entire file:
```typescript
import { Injectable } from '@nestjs/common';
import * as SorobanRpc from '@stellar/stellar-sdk/rpc';

@Injectable()
export class BlockchainService {
  private server: SorobanRpc.Server;

  constructor() {
    const rpcUrl = process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org';
    this.server = new SorobanRpc.Server(rpcUrl);
  }

  getServer(): SorobanRpc.Server {
    return this.server;
  }

  getConfidentialTokenContract(): string {
    return process.env.CONFIDENTIAL_TOKEN_CONTRACT || '';
  }

  getPayrollContract(): string {
    return process.env.AURAFLOW_PAYROLL_CONTRACT || '';
  }

  getUsdcContract(): string {
    return process.env.USDC_CONTRACT || 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA';
  }

  getNetworkPassphrase(): string {
    return process.env.STELLAR_NETWORK_PASSPHRASE || 'Test SDF Future Network ; October 2022';
  }
}
```

---

## Step 5: Replace Wallet Auth (Signature Verification)

**File:** `src/common/wallet-auth.util.ts`

### 5a. Replace imports

**Remove:**
```typescript
import { verifyMessage } from 'viem';
```

**Add:**
```typescript
import nacl from 'tweetnacl';
```

### 5b. Replace `verifySignedWalletRequest` function

```typescript
export async function verifySignedWalletRequest(input: {
  headers: Record<string, string>;
  expectedWallet: string;
  method: string;
  path: string;
  body?: string;
  maxAgeMs?: number;
}) {
  const wallet = input.headers[AURAFLOW_AUTH_WALLET_HEADER]?.trim() ?? '';
  const timestamp = input.headers[AURAFLOW_AUTH_TIMESTAMP_HEADER]?.trim() ?? '';
  const signature = input.headers[AURAFLOW_AUTH_SIGNATURE_HEADER]?.trim() ?? '';

  if (!wallet || !timestamp || !signature) throw new Error('Missing request authorization headers');
  // Stellar addresses are G... format, case-sensitive comparison
  if (wallet !== input.expectedWallet) throw new Error('Wallet authorization does not match');

  const parsedTimestamp = Date.parse(timestamp);
  if (!Number.isFinite(parsedTimestamp)) throw new Error('Invalid timestamp');

  const ageMs = Date.now() - parsedTimestamp;
  if (ageMs > (input.maxAgeMs ?? DEFAULT_MAX_AGE_MS)) throw new Error('Request authorization has expired');
  if (ageMs < -MAX_FUTURE_SKEW_MS) throw new Error('Timestamp is too far in the future');

  const message = await buildWalletRequestAuthMessage({
    wallet, method: input.method, path: input.path, timestamp, body: input.body,
  });

  try {
    // Stellar uses Ed25519 signatures
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = Uint8Array.from(Buffer.from(signature, 'base64'));
    // Stellar public keys are base32-encoded G... addresses; decode to 32-byte Ed25519 public key
    const publicKeyBytes = Uint8Array.from(Buffer.from(wallet, 'base64'));

    const verified = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
    if (!verified) throw new Error('Invalid signature');
  } catch (err: any) {
    throw new Error('Invalid signature: ' + err.message);
  }

  return { wallet, timestamp };
}
```

### 5c. Update `verifyWalletSessionToken` — remove `.toLowerCase()` comparisons

Stellar addresses are case-sensitive. Change line 136 from:
```typescript
if (payload.wallet.toLowerCase() !== expectedWallet.toLowerCase())
```
to:
```typescript
if (payload.wallet !== expectedWallet)
```

---

## Step 6: Replace Key Generation in Companies Service

**File:** `src/companies/companies.service.ts`

### 6a. Replace imports

**Remove:**
```typescript
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
```

**Add:**
```typescript
import { Keypair } from '@stellar/stellar-sdk';
```

### 6b. Replace key generation (lines 75-78)

```typescript
// Old (Ethereum):
const treasuryPrivateKey = generatePrivateKey();
const settlementPrivateKey = generatePrivateKey();
const treasuryAccount = privateKeyToAccount(treasuryPrivateKey);
const settlementAccount = privateKeyToAccount(settlementPrivateKey);

// New (Stellar):
const treasuryKeypair = Keypair.random();
const settlementKeypair = Keypair.random();
```

### 6c. Replace public key references (lines 85-86)

```typescript
// Old:
treasuryPubkey: treasuryAccount.address,
settlementPubkey: settlementAccount.address,

// New:
treasuryPubkey: treasuryKeypair.publicKey(),
settlementPubkey: settlementKeypair.publicKey(),
```

### 6d. Replace key storage (lines 89-98)

```typescript
// Old:
const treasuryEnc = encryptSecretKey(treasuryPrivateKey);
await this.keys().insertOne({
  id: crypto.randomUUID(), companyId, kind: 'treasury', pubkey: treasuryAccount.address,
  ...treasuryEnc, createdAt: now,
});
const settlementEnc = encryptSecretKey(settlementPrivateKey);
await this.keys().insertOne({
  id: crypto.randomUUID(), companyId, kind: 'settlement', pubkey: settlementAccount.address,
  ...settlementEnc, createdAt: now,
});

// New:
const treasuryEnc = encryptSecretKey(treasuryKeypair.secret());
await this.keys().insertOne({
  id: crypto.randomUUID(), companyId, kind: 'treasury', pubkey: treasuryKeypair.publicKey(),
  ...treasuryEnc, createdAt: now,
});
const settlementEnc = encryptSecretKey(settlementKeypair.secret());
await this.keys().insertOne({
  id: crypto.randomUUID(), companyId, kind: 'settlement', pubkey: settlementKeypair.publicKey(),
  ...settlementEnc, createdAt: now,
});
```

### 6e. Remove `.toLowerCase()` from wallet lookups

Stellar addresses are case-sensitive. Update `findByEmployerWallet` (line 56):
```typescript
// Old:
return this.companies().findOne({ employerWallet: wallet.trim().toLowerCase() });
// New:
return this.companies().findOne({ employerWallet: wallet.trim() });
```

And the `create` method (line 70):
```typescript
// Old:
const employerWallet = parsed.employerWallet.toLowerCase();
// New:
const employerWallet = parsed.employerWallet.trim();
```

---

## Step 7: Replace Treasury Service

**File:** `src/treasury/treasury.service.ts`

Replace entire file:
```typescript
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { contract } from '@stellar/stellar-sdk';

@Injectable()
export class TreasuryService {
  constructor(
    private readonly db: DatabaseService,
    private readonly blockchain: BlockchainService,
  ) {}

  async getOnChainBalance(employerWallet: string): Promise<string> {
    try {
      const server = this.blockchain.getServer();
      const payrollContract = this.blockchain.getPayrollContract();
      const usdcContract = this.blockchain.getUsdcContract();

      // Build Soroban contract read for treasury_balances(employer, usdc)
      const result = await server.getContractValue(
        payrollContract,
        contract.Ui128('treasury_balances', [
          contract.Address(employerWallet),
          contract.Address(usdcContract),
        ]),
      );

      return result.toString();
    } catch {
      return '0';
    }
  }
}
```

---

## Step 8: Replace Private Payroll Service

**File:** `src/private-payroll/private-payroll.service.ts`

Replace entire file with real Soroban contract invocation:
```typescript
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { CompaniesService } from '../companies/companies.service';
import { Keypair } from '@stellar/stellar-sdk';
import { TransactionBuilder, contract } from '@stellar/stellar-sdk';

@Injectable()
export class PrivatePayrollService {
  constructor(
    private readonly db: DatabaseService,
    private readonly blockchain: BlockchainService,
    private readonly companiesService: CompaniesService,
  ) {}

  async sendPrivatePayroll(input: {
    employerWallet: string;
    payPeriod: string;
    recipients: Array<{ employeeId?: string; name?: string; address: string; amount: number }>;
  }) {
    const company = await this.db.collection('companies').findOne({ employerWallet: input.employerWallet });
    if (!company) throw new Error('Company not found');

    const encryptedKey = await this.companiesService.loadPrivateKey(company.id, 'treasury');
    const treasuryKeypair = Keypair.fromSecret(encryptedKey);

    const server = this.blockchain.getServer();
    const payrollContract = this.blockchain.getPayrollContract();
    const confidentialToken = this.blockchain.getConfidentialTokenContract();

    const totalAmountMicro = input.recipients.reduce(
      (sum, r) => sum + Math.round(r.amount * 1_000_000), 0,
    );

    // Build Soroban transaction for batch confidential transfer
    const account = await server.getAccount(treasuryKeypair.publicKey());
    const transaction = new TransactionBuilder(account, {
      fee: '100000',
      networkPassphrase: this.blockchain.getNetworkPassphrase(),
    })
      .addOperation(
        contract.call(payrollContract, 'process_payroll_batch', [
          contract.Address(input.employerWallet),
          contract.Address(confidentialToken),
          contract.U32(input.recipients.length),
        ]),
      )
      .setTimeout(300)
      .build();

    transaction.sign(treasuryKeypair);

    const result = await server.sendTransaction(transaction);

    return {
      companyId: company.id,
      totalAmountMicro,
      txHash: result.hash,
      transferResults: input.recipients.map(r => ({
        address: r.address,
        amount: r.amount,
        amountMicro: Math.round(r.amount * 1_000_000),
      })),
    };
  }
}
```

---

## Step 9: Update Employees Service

**File:** `src/employees/employees.service.ts`

No changes needed to the core CRUD logic. The `privateRecipientInitStatus` fields remain the same — they track whether the employee's confidential token vault has been registered on-chain.

The `sponsorInitializeVault` and `markPrivateRecipientInitialized` methods are fine as-is since they update DB state. The actual on-chain registration call happens in the controller or a separate service method.

---

## Step 10: Update Blockchain Module

**File:** `src/blockchain/blockchain.module.ts`

No changes needed — it already exports `BlockchainService`.

---

## Step 11: Build and Verify

```bash
cd /Users/user/Downloads/Backend/auraflow-backend

# Install updated dependencies
npm install

# Build
npm run build

# Verify no TypeScript errors
npx tsc -p tsconfig.build.json --skipLibCheck --noEmit
```

---

## Step 12: Test on Stellar Testnet

1. Deploy contracts (see Contract migration guide)
2. Set environment variables in `.env`
3. Start the backend: `npm run start:dev`
4. Test auth flow with a Stellar wallet signing test messages
5. Test treasury balance read against deployed Soroban contract
6. Test private payroll send with a funded testnet account

---

## Migration Checklist

- [ ] `viem` removed from `package.json`
- [ ] `@stellar/stellar-sdk` added to `package.json`
- [ ] `.env.example` updated with Stellar vars
- [ ] `configuration.ts` updated
- [ ] `blockchain.service.ts` — SorobanRpc.Server replaces createPublicClient
- [ ] `wallet-auth.util.ts` — Ed25519 verification replaces ECDSA
- [ ] `companies.service.ts` — Keypair.random() replaces generatePrivateKey
- [ ] `treasury.service.ts` — Soroban contract read replaces readContract
- [ ] `private-payroll.service.ts` — Real Soroban invocation replaces mock
- [ ] All `.toLowerCase()` wallet comparisons removed (Stellar addresses are case-sensitive)
- [ ] `npm run build` passes
- [ ] Backend starts without errors

---

## Key Differences

| Aspect | Ethereum (Viem) | Stellar (SDK) |
|--------|-----------------|---------------|
| Signature scheme | ECDSA (secp256k1) | Ed25519 |
| Address format | `0x...` (42 chars) | `G...` (56 chars) |
| Private key | 0x-prefixed hex (64 hex chars) | Stellar secret (base32, 56 chars) |
| RPC client | `createPublicClient()` | `SorobanRpc.Server()` |
| Contract reads | `publicClient.readContract({ abi, ... })` | `server.getContractValue(id, contract.fn())` |
| Contract writes | `walletClient.writeContract()` | `TransactionBuilder` + `server.sendTransaction()` |
| Key generation | `generatePrivateKey()` | `Keypair.random()` |
| Key import | `privateKeyToAccount(key)` | `Keypair.fromSecret(secret)` |
| Case sensitivity | Addresses lowercase-insensitive | Addresses case-sensitive |
| Network | Arbitrum Sepolia | Stellar Testnet |
