import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { TransactionBuilder, Address, Contract, nativeToScVal, xdr } from '@stellar/stellar-sdk';

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

    const recipientAddrsScVals = input.recipients.map(r => new Address(r.address).toScVal());
    const amountsScVals = input.recipients.map(r => nativeToScVal(Math.round(r.amount * 1_000_000), { type: 'i128' }));

    const contractInstance = new Contract(payrollContract);

    const unsignedTx = new TransactionBuilder(account, {
      fee: '500000',
      networkPassphrase: this.blockchain.getNetworkPassphrase(),
    })
      .addOperation(
        contractInstance.call(
          'process_payroll_batch',
          new Address(input.employerWallet).toScVal(),
          xdr.ScVal.scvVec(recipientAddrsScVals),
          xdr.ScVal.scvVec(amountsScVals),
        ),
      )
      .setTimeout(300)
      .build();

    let transaction;
    let simulationWarning: string | undefined;
    try {
      transaction = await server.prepareTransaction(unsignedTx);
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.includes('HostError') || msg.includes('Contract')) {
        simulationWarning = `Simulation failed (vault may lack USDC): ${msg.slice(0, 200)}`;
        transaction = unsignedTx;
      } else {
        throw err;
      }
    }

    const totalAmountMicro = input.recipients.reduce(
      (sum, r) => sum + Math.round(r.amount * 1_000_000), 0,
    );

    return {
      xdr: transaction.toXDR(),
      networkPassphrase: this.blockchain.getNetworkPassphrase(),
      totalAmountMicro,
      simulationWarning,
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
    const rpcUrl = process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org';

    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'sendTransaction',
        params: { transaction: signedXdr },
      }),
    });
    const data = await res.json();

    if (data.error) {
      throw new Error(`Soroban submit failed: ${JSON.stringify(data.error).slice(0, 500)}`);
    }

    const result = data.result;
    if (result?.status === 'ERROR') {
      const diagnostic = result.diagnosticEvents ? JSON.stringify(result.diagnosticEvents).slice(0, 2000) : '';
      const errorResult = result.errorResult ? JSON.stringify(result.errorResult).slice(0, 2000) : '';
      throw new Error(`Soroban submit failed: ${result.status} ${errorResult} ${diagnostic}`.trim());
    }

    return {
      txHash: result?.hash || '',
      status: result?.status || 'PENDING',
    };
  }
}
