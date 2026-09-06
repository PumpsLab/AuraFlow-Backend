import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { TransactionBuilder, Address, Contract, nativeToScVal } from '@stellar/stellar-sdk';

@Injectable()
export class PrivatePayrollService {
  constructor(
    private readonly db: DatabaseService,
    private readonly blockchain: BlockchainService,
  ) {}

  async buildTransaction(input: {
    employerWallet: string;
    payPeriod: string;
    recipients: Array<{ employeeId?: string; name?: string; address: string; amount: number }>;
  }) {
    const company = await this.db.collection('companies').findOne({ employerWallet: input.employerWallet });
    if (!company) throw new Error('Company not found');

    const server = this.blockchain.getServer();
    const payrollContract = this.blockchain.getPayrollContract();

    const account = await server.getAccount(input.employerWallet);

    const recipientAddrs = input.recipients.map(r => new Address(r.address).toScVal());
    const amounts = input.recipients.map(r => nativeToScVal(Math.round(r.amount * 1_000_000), { type: 'i128' }));

    const contractInstance = new Contract(payrollContract);
    const transaction = new TransactionBuilder(account, {
      fee: '100000',
      networkPassphrase: this.blockchain.getNetworkPassphrase(),
    })
      .addOperation(
        contractInstance.call(
          'process_payroll_batch',
          new Address(input.employerWallet).toScVal(),
          nativeToScVal(recipientAddrs),
          nativeToScVal(amounts),
        ),
      )
      .setTimeout(300)
      .build();

    const totalAmountMicro = input.recipients.reduce(
      (sum, r) => sum + Math.round(r.amount * 1_000_000), 0,
    );

    return {
      xdr: transaction.toXDR(),
      networkPassphrase: this.blockchain.getNetworkPassphrase(),
      totalAmountMicro,
      recipients: input.recipients.map(r => ({
        address: r.address,
        name: r.name,
        amount: r.amount,
        amountMicro: Math.round(r.amount * 1_000_000),
      })),
      companyId: company.id,
    };
  }

  async submitTransaction(signedXdr: string) {
    const server = this.blockchain.getServer();
    const transaction = TransactionBuilder.fromXDR(
      signedXdr,
      this.blockchain.getNetworkPassphrase(),
    );
    const result = await server.sendTransaction(transaction);
    return {
      txHash: result.hash,
      status: result.status,
    };
  }
}
