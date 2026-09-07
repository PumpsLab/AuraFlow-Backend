import { Injectable } from '@nestjs/common';
import { rpc, Horizon } from '@stellar/stellar-sdk';

@Injectable()
export class BlockchainService {
  private server: rpc.Server;
  private horizon: Horizon.Server;

  constructor() {
    const rpcUrl = process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org';
    this.server = new rpc.Server(rpcUrl);
    const horizonUrl = process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org';
    this.horizon = new Horizon.Server(horizonUrl);
  }

  getServer(): rpc.Server {
    return this.server;
  }

  getHorizon(): Horizon.Server {
    return this.horizon;
  }

  getConfidentialTokenContract(): string {
    return process.env.CONFIDENTIAL_TOKEN_CONTRACT || '';
  }

  getPayrollContract(): string {
    return process.env.AURAFLOW_PAYROLL_CONTRACT || '';
  }

  getVerifierContract(): string {
    return process.env.VERIFIER_CONTRACT || '';
  }

  getAuditorContract(): string {
    return process.env.AUDITOR_CONTRACT || '';
  }

  getUsdcContract(): string {
    return process.env.USDC_CONTRACT || 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA';
  }

  getNetworkPassphrase(): string {
    return process.env.STELLAR_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015';
  }
}
