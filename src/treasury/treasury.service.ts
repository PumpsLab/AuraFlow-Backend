import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { BlockchainService } from '../blockchain/blockchain.service';

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

      const { result } = await server.queryContract<bigint>(
        payrollContract,
        'treasury_balances',
        {
          employer: employerWallet,
          token: usdcContract,
        },
      );

      return result.toString();
    } catch {
      return '0';
    }
  }
}