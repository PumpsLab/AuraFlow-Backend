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

  async getPrivateBalance(address: string): Promise<number> {
    const confidentialToken = this.getConfidentialTokenContract();
    if (!confidentialToken) return 0;

    try {
      const contract = new (await import('@stellar/stellar-sdk')).Contract(confidentialToken);
      const account = await this.server.getAccount(confidentialToken);
      const { TransactionBuilder, Address } = await import('@stellar/stellar-sdk');

      const tx = new TransactionBuilder(account, {
        fee: '100000',
        networkPassphrase: this.getNetworkPassphrase(),
      })
        .addOperation(
          contract.call(
            'get_commitment',
            new Address(address).toScVal(),
          ),
        )
        .setTimeout(300)
        .build();

      const result: any = await this.server.simulateTransaction(tx);
      if (result.error) return 0;
      const val = result.result?.retval;
      if (!val) return 0;
      return Number(val.i128?.lo ?? val.i128 ?? 0);
    } catch {
      return 0;
    }
  }

  async getVaultUsdcBalance(): Promise<number> {
    const usdcContract = this.getUsdcContract();
    const payrollContract = this.getPayrollContract();
    if (!usdcContract || !payrollContract) return 0;

    try {
      const contract = new (await import('@stellar/stellar-sdk')).Contract(usdcContract);
      const account = await this.server.getAccount(usdcContract);
      const { TransactionBuilder, Address } = await import('@stellar/stellar-sdk');

      const tx = new TransactionBuilder(account, {
        fee: '100000',
        networkPassphrase: this.getNetworkPassphrase(),
      })
        .addOperation(
          contract.call(
            'balance',
            new Address(payrollContract).toScVal(),
          ),
        )
        .setTimeout(300)
        .build();

      const result: any = await this.server.simulateTransaction(tx);
      if (result.error) return 0;
      const val = result.result?.retval;
      if (!val) return 0;
      return Number(val.i128?.lo ?? val.i128 ?? 0);
    } catch {
      return 0;
    }
  }
}
