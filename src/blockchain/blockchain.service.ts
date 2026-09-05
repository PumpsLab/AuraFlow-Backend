import { Injectable } from '@nestjs/common';
import { rpc } from '@stellar/stellar-sdk';

@Injectable()
export class BlockchainService {
  private server: rpc.Server;

  constructor() {
    const rpcUrl = process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org';
    this.server = new rpc.Server(rpcUrl);
  }

  getServer(): rpc.Server {
    return this.server;
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
    return process.env.STELLAR_NETWORK_PASSPHRASE || 'Test SDF Future Network ; October 2022';
  }
}
