import { Injectable } from '@nestjs/common';
import * as crypto from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import type { Company, CreateCompanyInput, PublicCompanyResponse, EncryptedCompanyKey } from './company-types';
import { Keypair, TransactionBuilder, Operation, Asset } from '@stellar/stellar-sdk';
import { z } from 'zod';

const createCompanySchema = z.object({
  name: z.string().min(2).max(80),
  employerWallet: z.string().min(56),
  message: z.string().optional(),
  signature: z.string().optional(),
});

function encryptionKey(): Buffer {
  const secret = process.env.COMPANY_KEY_ENCRYPTION_SECRET || '';
  if (secret.length < 32) throw new Error('COMPANY_KEY_ENCRYPTION_SECRET must be at least 32 characters');
  return crypto.createHash('sha256').update(secret).digest();
}

function encryptSecretKey(secretKey: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secretKey, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    encryptedSecretKeyBase64: encrypted.toString('base64'),
    ivBase64: iv.toString('base64'),
    authTagBase64: authTag.toString('base64'),
  };
}

function decryptSecretKey(record: EncryptedCompanyKey): string {
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(record.ivBase64, 'base64'));
  decipher.setAuthTag(Buffer.from(record.authTagBase64, 'base64'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(record.encryptedSecretKeyBase64, 'base64')), decipher.final()]);
  return decrypted.toString('utf8');
}

function toPublicCompany(company: Company): PublicCompanyResponse {
  return {
    id: company.id, name: company.name, employerWallet: company.employerWallet,
    treasuryPubkey: company.treasuryPubkey, settlementPubkey: company.settlementPubkey,
    currency: company.currency, createdAt: company.createdAt, updatedAt: company.updatedAt,
  };
}

@Injectable()
export class CompaniesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly blockchain: BlockchainService,
  ) {}

  private companies() { return this.db.collection('companies'); }
  private keys() { return this.db.collection('company_keys'); }

  async findByEmployerWallet(wallet: string): Promise<Company | null> {
    return this.companies().findOne({ employerWallet: wallet.trim() });
  }

  async findById(companyId: string): Promise<Company | null> {
    return this.companies().findOne({ id: companyId });
  }

  async getPublicCompany(employerWallet: string): Promise<PublicCompanyResponse | null> {
    const company = await this.findByEmployerWallet(employerWallet);
    return company ? toPublicCompany(company) : null;
  }

  async create(input: CreateCompanyInput): Promise<PublicCompanyResponse> {
    const parsed = createCompanySchema.parse(input);
    const employerWallet = parsed.employerWallet.trim();

    const existing = await this.findByEmployerWallet(employerWallet);
    if (existing) return toPublicCompany(existing);

    const treasuryKeypair = Keypair.random();
    const settlementKeypair = Keypair.random();

    const now = new Date().toISOString();
    const companyId = crypto.randomUUID();

    const company: Company = {
      id: companyId, name: parsed.name.trim(), employerWallet,
      treasuryPubkey: treasuryKeypair.publicKey(), settlementPubkey: settlementKeypair.publicKey(),
      currency: 'USDC', createdAt: now, updatedAt: now,
    };

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

    await this.companies().insertOne(company);
    return toPublicCompany(company);
  }

  async loadPrivateKey(companyId: string, kind: 'treasury' | 'settlement'): Promise<string> {
    const record = await this.keys().findOne({ companyId, kind });
    if (!record) throw new Error(`Missing ${kind} key for company ${companyId}`);
    return decryptSecretKey(record);
  }

  private getUsdcAsset(): Asset {
    const issuer = process.env.USDC_ISSUER || 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
    return new Asset('USDC', issuer);
  }

  async getTreasuryXlmBalance(companyId: string): Promise<string> {
    const company = await this.findById(companyId);
    if (!company) throw new Error('Company not found');
    const horizon = this.blockchain.getHorizon();
    try {
      const account = await horizon.loadAccount(company.treasuryPubkey);
      const nativeBalance = account.balances.find((b: any) => b.asset_type === 'native');
      return nativeBalance ? nativeBalance.balance : '0';
    } catch {
      return '0';
    }
  }

  async getTreasuryUsdcBalance(companyId: string): Promise<string> {
    const company = await this.findById(companyId);
    if (!company) throw new Error('Company not found');
    const horizon = this.blockchain.getHorizon();
    try {
      const account = await horizon.loadAccount(company.treasuryPubkey);
      const usdc = this.getUsdcAsset();
      const usdcBalance = account.balances.find(
        (b: any) => b.asset_type === 'credit_alphanum4' && b.asset_code === usdc.code && b.asset_issuer === usdc.issuer,
      );
      return usdcBalance ? usdcBalance.balance : '0';
    } catch {
      return '0';
    }
  }

  async hasUsdcTrustline(companyId: string): Promise<boolean> {
    const company = await this.findById(companyId);
    if (!company) throw new Error('Company not found');
    const horizon = this.blockchain.getHorizon();
    try {
      const account = await horizon.loadAccount(company.treasuryPubkey);
      const usdc = this.getUsdcAsset();
      return account.balances.some(
        (b: any) => b.asset_type === 'credit_alphanum4' && b.asset_code === usdc.code && b.asset_issuer === usdc.issuer,
      );
    } catch {
      return false;
    }
  }

  async getTreasuryBalance(companyId: string): Promise<{ xlm: string; usdc: string; hasTrustline: boolean }> {
    const company = await this.findById(companyId);
    if (!company) throw new Error('Company not found');
    const [xlm, usdc, hasTrustline] = await Promise.all([
      this.getTreasuryXlmBalance(companyId),
      this.getTreasuryUsdcBalance(companyId),
      this.hasUsdcTrustline(companyId),
    ]);
    return { xlm, usdc, hasTrustline };
  }

  async setupTrustline(companyId: string, wallet: string): Promise<{ txHash: string }> {
    const company = await this.findById(companyId);
    if (!company) throw new Error('Company not found');
    if (company.employerWallet !== wallet) throw new Error('Unauthorized');

    const secret = await this.loadPrivateKey(companyId, 'treasury');
    const keypair = Keypair.fromSecret(secret);
    const server = this.blockchain.getServer();
    const horizon = this.blockchain.getHorizon();
    const networkPassphrase = this.blockchain.getNetworkPassphrase();

    const account = await horizon.loadAccount(keypair.publicKey());
    const usdc = this.getUsdcAsset();

    const tx = new TransactionBuilder(account, { fee: '100000', networkPassphrase })
      .addOperation(Operation.changeTrust({ asset: usdc }))
      .setTimeout(300)
      .build();

    tx.sign(keypair);
    const result = await server.sendTransaction(tx);
    return { txHash: result.hash };
  }
}
