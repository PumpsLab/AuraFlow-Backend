import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { CompaniesService } from '../companies/companies.service';
import { Keypair, TransactionBuilder, Address, Contract } from '@stellar/stellar-sdk';

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

    const account = await server.getAccount(treasuryKeypair.publicKey());
    const contractInstance = new Contract(payrollContract);
    const transaction = new TransactionBuilder(account, {
      fee: '100000',
      networkPassphrase: this.blockchain.getNetworkPassphrase(),
    })
      .addOperation(
        contractInstance.call(
          'process_payroll_batch',
          new Address(input.employerWallet).toScVal(),
          new Address(confidentialToken).toScVal(),
        ),
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